/*
 * Open-Cast Mine Collision Avoidance — ESP32-CAM vehicle node
 * ------------------------------------------------------------
 * Hardware : AI-Thinker ESP32-CAM, HC-SR04, L298N, 2x TT DC motors
 * Protocol : Socket.IO telemetry to the FastAPI backend + MJPEG camera stream
 *
 * Libraries (Arduino Library Manager):
 *   - WebSockets by Markus Sattler   (provides SocketIOclient)
 *   - ArduinoJson by Benoit Blanchon
 *
 * Wiring:
 *   HC-SR04  TRIG -> GPIO13, ECHO -> GPIO12 (through a 1k/2k divider to 3V3)
 *   L298N    IN1 -> GPIO14, IN2 -> GPIO15   (left motor)
 *            IN3 -> GPIO2,  IN4 -> GPIO4    (right motor)
 *   NOTE: GPIO4 also drives the on-board flash LED and GPIO2/14/15 are shared
 *   with the SD card — keep the SD card slot unused.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <SocketIOclient.h>
#include "esp_camera.h"
#include "camera_pins.h"

// ----------------------- USER CONFIG -----------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST   = "192.168.1.50";   // FastAPI backend IP
const uint16_t SERVER_PORT = 8000;
// -----------------------------------------------------------

// Pin map
static const uint8_t TRIG_PIN = 13;
static const uint8_t ECHO_PIN = 12;
static const uint8_t IN1 = 14;   // left motor
static const uint8_t IN2 = 15;
static const uint8_t IN3 = 2;    // right motor
static const uint8_t IN4 = 4;

// Safety thresholds (must match backend config)
static const float CRITICAL_CM = 20.0f;
static const float WARNING_CM  = 45.0f;

SocketIOclient socketIO;

// Non-blocking ultrasonic state machine
enum PingState { PING_IDLE, PING_TRIGGER, PING_WAIT };
PingState pingState = PING_IDLE;
unsigned long pingTimer = 0;
float lastDistance = 999.0f;

unsigned long lastSend = 0;
bool autoMode = true;
String currentCommand = "STOP";
int speedLimit = 65;          // % (from dashboard)
bool ultrasonicOn = true;

// ---- Optional extra sensors (set to 1 if wired, e.g. on a second ESP32/I2C bus) ----
#define HAS_MMWAVE   0   // LD2410 / RCWL-0516 OUT pin -> MMWAVE_PIN
#define HAS_BATTERY  0   // voltage divider -> BATTERY_PIN (ADC)
static const int MMWAVE_PIN  = 16;
static const int BATTERY_PIN = 33;
static const float BATTERY_DIVIDER = 2.0f;   // R1=R2
// Thermal (MLX90614 / AMG8833) readings can be added in readThermal().
float readThermal() { return NAN; }

// ------------------------- MOTORS -------------------------
void motorStop() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}
void motorForward() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}
void motorBackward() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
}
void motorLeft() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}
void motorRight() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
}

void applyCommand(const String& cmd) {
  currentCommand = cmd;
  if (cmd == "FORWARD")       motorForward();
  else if (cmd == "BACKWARD") motorBackward();
  else if (cmd == "LEFT")     motorLeft();
  else if (cmd == "RIGHT")    motorRight();
  else                        motorStop();
}

// --------------------- ULTRASONIC (non-blocking) ---------------------
void updateDistance() {
  unsigned long now = micros();
  switch (pingState) {
    case PING_IDLE:
      digitalWrite(TRIG_PIN, LOW);
      pingTimer = now;
      pingState = PING_TRIGGER;
      break;
    case PING_TRIGGER:
      if (now - pingTimer >= 4) {
        digitalWrite(TRIG_PIN, HIGH);
        pingTimer = now;
        pingState = PING_WAIT;
      }
      break;
    case PING_WAIT:
      if (now - pingTimer >= 10) {
        digitalWrite(TRIG_PIN, LOW);
        // 25 ms timeout ~ 4.3 m maximum range
        unsigned long duration = pulseIn(ECHO_PIN, HIGH, 25000UL);
        if (duration > 0) {
          float d = duration * 0.0343f / 2.0f;
          lastDistance = (lastDistance * 0.6f) + (d * 0.4f);  // light smoothing
        }
        pingState = PING_IDLE;
      }
      break;
  }
}

// --------------------- SOCKET.IO ---------------------
void sendTelemetry(float distance) {
  JsonDocument doc;
  JsonArray payload = doc.to<JsonArray>();
  payload.add("telemetry");
  JsonObject body = payload.add<JsonObject>();
  body["distance_cm"] = distance;
  body["speed_pct"] = currentCommand == "STOP" ? 0 : speedLimit;
  body["sent_ms"] = 0;
  body["uptime_s"] = millis() / 1000;
  body["ram_pct"] = 100 - (ESP.getFreeHeap() * 100 / ESP.getHeapSize());
  body["cpu_temp_c"] = temperatureRead();
  body["rssi_dbm"] = WiFi.RSSI();
  float th = readThermal();
  if (!isnan(th)) body["thermal_c"] = th;
#if HAS_MMWAVE
  body["mmwave_presence"] = digitalRead(MMWAVE_PIN) == HIGH;
#endif
#if HAS_BATTERY
  float v = analogReadMilliVolts(BATTERY_PIN) / 1000.0f * BATTERY_DIVIDER;
  body["battery_v"] = v;
  body["battery_pct"] = constrain((int)((v - 6.4f) / 2.0f * 100), 0, 100);  // 2S Li-ion
#endif
  String out;
  serializeJson(doc, out);
  socketIO.sendEVENT(out);
}

void handleEvent(uint8_t* payload, size_t length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;
  String event = doc[0] | "";
  if (event == "command") {
    String action = doc[1]["action"] | "STOP";
    applyCommand(action);
  } else if (event == "mode") {
    autoMode = doc[1]["auto"] | true;
  } else if (event == "hw") {
    String key = doc[1]["key"] | "";
    sensor_t* cam = esp_camera_sensor_get();
    if (key == "speed_limit") speedLimit = doc[1]["value"] | 65;
    else if (key == "reboot") ESP.restart();
    else if (key == "ultrasonic_enabled") ultrasonicOn = doc[1]["value"] | true;
    else if (key == "cam_quality" && cam) cam->set_quality(cam, doc[1]["value"] | 12);
    else if (key == "cam_resolution" && cam) {
      String r = doc[1]["value"] | "VGA";
      cam->set_framesize(cam, r == "QVGA" ? FRAMESIZE_QVGA : r == "SVGA" ? FRAMESIZE_SVGA : r == "HD" ? FRAMESIZE_HD : FRAMESIZE_VGA);
    }
    // headlights / horn / pan / tilt: wire to spare GPIOs or a PCA9685 and handle here.
  }
}

void socketEvent(socketIOmessageType_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case sIOtype_CONNECT:
      Serial.println("[socket] connected");
      socketIO.send(sIOtype_CONNECT, "/");
      break;
    case sIOtype_DISCONNECT:
      Serial.println("[socket] disconnected");
      motorStop();
      break;
    case sIOtype_EVENT:
      handleEvent(payload, length);
      break;
    default:
      break;
  }
}

// --------------------- CAMERA ---------------------
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;   config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;   config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;   config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;   config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;   config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM; config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;   config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = psramFound() ? FRAMESIZE_VGA : FRAMESIZE_QVGA;
  config.jpeg_quality = psramFound() ? 12 : 16;
  config.fb_count = psramFound() ? 2 : 1;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("camera init failed: 0x%x\n", err);
    return false;
  }
  return true;
}

// MJPEG stream server on port 81 -> http://<esp-ip>:81/stream
WiFiServer streamServer(81);

void serveStream(WiFiClient& client) {
  client.println("HTTP/1.1 200 OK");
  client.println("Access-Control-Allow-Origin: *");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
  client.println();
  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) break;
    client.printf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");
    esp_camera_fb_return(fb);
    delay(40);
    updateDistance();
  }
  client.stop();
}

// --------------------- SETUP / LOOP ---------------------
void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  motorStop();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());

  if (initCamera()) streamServer.begin();

  socketIO.begin(SERVER_HOST, SERVER_PORT, "/socket.io/?EIO=4&role=vehicle");
  socketIO.onEvent(socketEvent);
  socketIO.setReconnectInterval(3000);
}

void loop() {
  socketIO.loop();
  updateDistance();

  // Local safety interlock — never rely solely on the backend round-trip.
  if (lastDistance <= CRITICAL_CM && currentCommand == "FORWARD") {
    applyCommand("STOP");
  }

  WiFiClient client = streamServer.available();
  if (client) serveStream(client);

  if (millis() - lastSend >= 200) {
    lastSend = millis();
    sendTelemetry(lastDistance);
  }
}
