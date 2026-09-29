/**
 * The five haul trucks on site. Specs are the manufacturers' published figures
 * so the simulated data (speed, payload, fuel burn) stays in realistic ranges.
 * Map coordinates use a 1000 x 600 site grid (1 unit ≈ 1 m).
 */
export interface TruckSpec {
  id: string;
  name: string;
  maker: string;
  model: string;
  payload_t: number;
  engine_kw: number;
  top_speed_kmh: number;
  fuel_tank_l: number;
  empty_weight_t: number;
  color: string; // map marker hue (CSS color)
  video: string;
  videoCredit: string;
  /** index into ROUTES */
  route: number;
  /** per-truck environment/behaviour tweaks */
  profile: {
    engineBase: number; // °C coolant at cruise
    ambientOffset: number;
    presenceRate: number; // chance per tick a person enters radar
    fuelStart: number; // %
    obstacleRate: number;
  };
}

const W = "https://upload.wikimedia.org/wikipedia/commons/transcoded";

export const FOOTAGE = {
  cat777: `${W}/b/bc/Caterpillar_777.webm/Caterpillar_777.webm.480p.vp9.webm`,
  hauler: `${W}/7/72/Articulated_hauler_dump_truck.webm/Articulated_hauler_dump_truck.webm.480p.vp9.webm`,
  shovel: `${W}/0/0e/Rh40b.webm/Rh40b.webm.480p.vp9.webm`,
  pit1: `${W}/7/73/Boxberg_OL_-_Reichwalde_-_Tagebau_01_%28mT%29_ies.ogv/Boxberg_OL_-_Reichwalde_-_Tagebau_01_%28mT%29_ies.ogv.480p.vp9.webm`,
  pit3: `${W}/1/15/Boxberg_OL_-_Reichwalde_-_Tagebau_03_%28mT%29_ies.ogv/Boxberg_OL_-_Reichwalde_-_Tagebau_03_%28mT%29_ies.ogv.480p.vp9.webm`,
};

export const TRUCKS: TruckSpec[] = [
  {
    id: "HT-01", name: "Haul Truck 01", maker: "Tata Motors", model: "Signa 4825.TK",
    payload_t: 30, engine_kw: 186, top_speed_kmh: 60, fuel_tank_l: 365, empty_weight_t: 16,
    color: "#3b82f6", video: FOOTAGE.cat777, videoCredit: "Caterpillar 777 · Wikimedia Commons (CC BY-SA)", route: 0,
    profile: { engineBase: 88, ambientOffset: 0, presenceRate: 0.006, fuelStart: 82, obstacleRate: 1 },
  },
  {
    id: "HT-02", name: "Haul Truck 02", maker: "Ashok Leyland", model: "AVTR 2825 Tipper",
    payload_t: 18, engine_kw: 186, top_speed_kmh: 60, fuel_tank_l: 400, empty_weight_t: 10,
    color: "#10b981", video: FOOTAGE.hauler, videoCredit: "Articulated hauler · Wikimedia Commons (CC BY-SA)", route: 1,
    profile: { engineBase: 91, ambientOffset: 1.5, presenceRate: 0.012, fuelStart: 64, obstacleRate: 1.3 },
  },
  {
    id: "HT-03", name: "Haul Truck 03", maker: "BEML", model: "BH100 Dumper",
    payload_t: 100, engine_kw: 746, top_speed_kmh: 55, fuel_tank_l: 1400, empty_weight_t: 75,
    color: "#f59e0b", video: `${FOOTAGE.cat777}#t=70`, videoCredit: "Caterpillar 777 · Wikimedia Commons (CC BY-SA)", route: 2,
    profile: { engineBase: 94, ambientOffset: -1, presenceRate: 0.004, fuelStart: 47, obstacleRate: 0.8 },
  },
  {
    id: "HT-04", name: "Haul Truck 04", maker: "BharatBenz", model: "3528C Tipper",
    payload_t: 24, engine_kw: 210, top_speed_kmh: 60, fuel_tank_l: 380, empty_weight_t: 11,
    color: "#ef4444", video: `${FOOTAGE.cat777}#t=130`, videoCredit: "Caterpillar 777 · Wikimedia Commons (CC BY-SA)", route: 0,
    profile: { engineBase: 97, ambientOffset: 2, presenceRate: 0.008, fuelStart: 28, obstacleRate: 1.6 },
  },
  {
    id: "HT-05", name: "Haul Truck 05", maker: "Mahindra", model: "Blazo X 35 Tipper",
    payload_t: 24, engine_kw: 206, top_speed_kmh: 60, fuel_tank_l: 415, empty_weight_t: 11,
    color: "#8b5cf6", video: FOOTAGE.shovel, videoCredit: "Mining shovel loading · Wikimedia Commons (CC BY-SA)", route: 1,
    profile: { engineBase: 86, ambientOffset: 0.5, presenceRate: 0.015, fuelStart: 91, obstacleRate: 1.1 },
  },
];

export type Pt = [number, number];

/** Haul roads: shovel (start) → ramp out of pit → dump/crusher (end). */
export const ROUTES: { name: string; from: string; to: string; path: Pt[] }[] = [
  {
    name: "Ramp A → Crusher",
    from: "Shovel S1 (pit floor)",
    to: "Primary crusher",
    path: [[375, 350], [312, 300], [350, 240], [475, 206], [562, 262], [581, 375], [625, 438], [669, 365], [700, 330], [750, 262], [760, 215]],
  },
  {
    name: "Ramp B → Waste dump",
    from: "Shovel S2 (bench 3)",
    to: "Waste dump",
    path: [[438, 290], [350, 270], [262, 350], [206, 470], [150, 515], [120, 440], [125, 375], [80, 290]],
  },
  {
    name: "Ramp C → Stockpile",
    from: "Shovel S3 (bench 2)",
    to: "ROM stockpile",
    path: [[512, 312], [562, 406], [625, 500], [688, 390], [760, 385], [812, 388], [880, 300]],
  },
];

export const ZONES = [
  { id: "crusher", label: "Crusher & plant", x: 760, y: 200 },
  { id: "dump", label: "Waste dump", x: 70, y: 270 },
  { id: "stock", label: "ROM stockpile", x: 890, y: 285 },
  { id: "workshop", label: "Workshop", x: 800, y: 70 },
  { id: "pit", label: "Pit floor", x: 380, y: 345 },
];

export function truckFor(id: string): TruckSpec {
  return TRUCKS.find((t) => t.id === id) ?? { ...TRUCKS[0]!, id, name: id };
}

/** Walk a polyline by distance; returns point + heading (deg). */
export function pointOnPath(path: Pt[], d: number): { x: number; y: number; heading: number; length: number } {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!;
    const [bx, by] = path[i]!;
    const l = Math.hypot(bx - ax, by - ay);
    segs.push(l);
    total += l;
  }
  let rem = Math.max(0, Math.min(total, d));
  for (let i = 0; i < segs.length; i++) {
    const l = segs[i]!;
    if (rem <= l || i === segs.length - 1) {
      const [ax, ay] = path[i]!;
      const [bx, by] = path[i + 1]!;
      const f = l ? rem / l : 0;
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, heading: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI, length: total };
    }
    rem -= l;
  }
  const [x, y] = path[0]!;
  return { x, y, heading: 0, length: total };
}

/**
 * Presence tracks shaped like real 24 GHz radar (HLK-LD2410) captures of a
 * person near a vehicle: [distance cm, angle deg (-60..60), moving?] per tick.
 */
export const PRESENCE_TRACKS: Array<Array<[number, number, boolean]>> = [
  // worker walks across the front of the truck
  Array.from({ length: 30 }, (_, i) => [420 - Math.sin(i / 9) * 60, -55 + i * 3.8, true] as [number, number, boolean]),
  // spotter approaches, stops, walks away
  [
    ...Array.from({ length: 12 }, (_, i) => [560 - i * 28, 12, true] as [number, number, boolean]),
    ...Array.from({ length: 10 }, () => [225, 14, false] as [number, number, boolean]),
    ...Array.from({ length: 10 }, (_, i) => [225 + i * 32, 18 + i * 3, true] as [number, number, boolean]),
  ],
  // stationary surveyor at the side of the road
  Array.from({ length: 26 }, (_, i) => [330 + Math.sin(i) * 4, 38 + Math.sin(i / 3), i < 3 || i > 22] as [number, number, boolean]),
  // light vehicle driver gets out and circles
  Array.from({ length: 28 }, (_, i) => [300 + Math.cos(i / 4) * 90, Math.sin(i / 4) * 45, true] as [number, number, boolean]),
];
