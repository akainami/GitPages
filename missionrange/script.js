/* ============================================== Akainami 2026 =========
   ATMOSPHERE MODEL (adapted / condensed from user-supplied script.js)
   5-layer ISA model. Returns pressure ratio, temperature ratio
   and local speed of sound for a pressure altitude (ft) and a fixed
   mission-wide temperature deviation from ISA (deltaIsaC).
   ============================================== Akainami 2026 ========= */
const SEA_LEVEL_PRESSURE_PA = 101325, SEA_LEVEL_TEMPERATURE_K = 288.15, SPEED_OF_SOUND_SL_KT = 661.479;

function computeAtmosphere(pressureAltitudeFt, deltaIsaC) {
  const altitudeM = pressureAltitudeFt * 0.3048;
  let delta, oatKelvin;
  if (altitudeM >= -700 && altitudeM < 11000) { delta = (1 / SEA_LEVEL_PRESSURE_PA) * Math.pow(8.9619638 - 0.20216125e-3 * altitudeM, 5.2558797); oatKelvin = 288.15 - 6.5e-3 * altitudeM + deltaIsaC; }
  else if (altitudeM < 20000) { delta = (1 / SEA_LEVEL_PRESSURE_PA) * 128244.5 * Math.exp(-0.15768852e-3 * altitudeM); oatKelvin = 216.65 + deltaIsaC; }
  else if (altitudeM < 32000) { delta = (1 / SEA_LEVEL_PRESSURE_PA) * Math.pow(0.70551848 + 3.5876861e-6 * altitudeM, -34.163218); oatKelvin = 196.65 + 1e-3 * altitudeM + deltaIsaC; }
  else if (altitudeM < 47000) { delta = (1 / SEA_LEVEL_PRESSURE_PA) * Math.pow(0.34926867 + 7.0330980e-6 * altitudeM, -12.201149); oatKelvin = 139.05 + 2.8e-3 * altitudeM + deltaIsaC; }
  else if (altitudeM < 50000) { delta = (1 / SEA_LEVEL_PRESSURE_PA) * 41828.420 * Math.exp(-0.12622656e-3 * altitudeM); oatKelvin = 270.65 + deltaIsaC; }
  else { throw new RangeError("Pressure altitude is outside the definition range (-700 m to 50000 m)."); }
  const theta = oatKelvin / SEA_LEVEL_TEMPERATURE_K, speedOfSoundKt = SPEED_OF_SOUND_SL_KT * Math.sqrt(theta);
  return { delta, theta, speedOfSoundKt, staticPressurePa: SEA_LEVEL_PRESSURE_PA * delta };
}

// Converts calibrated airspeed (KCAS) to Mach and true airspeed (KTAS) at a given
// pressure altitude, using the standard subsonic compressible-flow relation. Subsonic-only
// is sufficient here: medevac / turboprop / light-jet cruise speeds never approach Mach 1.
function kcasToTrueAirspeed(pressureAltitudeFt, deltaIsaC, kcasKt) {
  const atmosphere = computeAtmosphere(pressureAltitudeFt, deltaIsaC);
  const impactPressureRatio = Math.pow(1 + 0.2 * Math.pow(kcasKt / SPEED_OF_SOUND_SL_KT, 2), 3.5) - 1;
  const totalToStaticRatio = (SEA_LEVEL_PRESSURE_PA / atmosphere.staticPressurePa) * impactPressureRatio + 1;
  const mach = Math.sqrt(5 * (Math.pow(totalToStaticRatio, 2 / 7) - 1));
  return { mach, trueAirspeedKt: mach * atmosphere.speedOfSoundKt, atmosphere };
}

/* ============================================== Akainami 2026 =========
   GEODESY - great-circle distance / bearing on a spherical Earth
   model (nautical miles).
   ============================================== Akainami 2026 ========= */
const EARTH_RADIUS_NM = 3440.065;
const toRad = deg => deg * Math.PI / 180, toDeg = rad => rad * 180 / Math.PI;

function greatCircleDistanceNm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1), la1 = toRad(lat1), la2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_NM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function initialBearingDeg(lat1, lon1, lat2, lon2) {
  const la1 = toRad(lat1), la2 = toRad(lat2), dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/* ============================================== Akainami 2026 =========
   WIND TRIANGLE - ground speed along a desired track, correcting
   heading for cross-wind drift (standard E6B wind-triangle solution).
   ============================================== Akainami 2026 ========= */
function windCorrectedGroundSpeedKt(trueAirspeedKt, windSpeedKt, windFromDeg, trackDeg) {
  const downwindDeg = windFromDeg + 180, relativeAngle = toRad(trackDeg - downwindDeg);
  const windCorrectionAngle = Math.asin(Math.min(1, Math.max(-1, (windSpeedKt / trueAirspeedKt) * Math.sin(relativeAngle))));
  return trueAirspeedKt * Math.cos(windCorrectionAngle) + windSpeedKt * Math.cos(relativeAngle);
}

/* ============================================== Akainami 2026 =========
   COVERAGE MODEL (5.1 - 5.4 combined into a single envelope)
   A point P is "covered" if the aircraft can depart from ANY defined
   base, reach P, and from P reach ANY defined base (the same one, for
   a round trip, or a different one, for a base-to-base transit) -
   all within the fixed time budget derived from the single mission
   distance D. This replaces separate per-base circles/ellipses with
   one fused coverage envelope, built and rendered as a raster.
   ============================================== Akainami 2026 ========= */
/* ============================================== Akainami 2026 =========
   COVERAGE MODEL - İki üs arası uçuşları kapsayan düzeltilmiş kontrol
   ============================================== Akainami 2026 ========= */
function isPointCovered(lat, lon, bases, trueAirspeedKt, windSpeedKt, windFromDeg, timeBudgetHr) {
  // Noktaya ulaşmak ve geri/diğer üsse dönmek için gereken MINIMUM toplam süreyi bulacağız
  let minTotalTimeHr = Infinity;

  for (const departureBase of bases) {
    // 1. Kalkış üssünden Hedef Noktaya (P) gidiş
    const bearingOut = initialBearingDeg(departureBase.lat, departureBase.lon, lat, lon);
    const distOutNm = greatCircleDistanceNm(departureBase.lat, departureBase.lon, lat, lon);
    const groundSpeedOut = Math.max(1, windCorrectedGroundSpeedKt(trueAirspeedKt, windSpeedKt, windFromDeg, bearingOut));
    const timeOutHr = distOutNm / groundSpeedOut;

    // Gidiş süresi bütçeyi zaten aşıyorsa bu kalkış üssünü atla
    if (timeOutHr > timeBudgetHr) continue;

    for (const landingBase of bases) {
      // 2. Hedef Noktadan (P) İniş üssüne gidiş
      const bearingIn = initialBearingDeg(lat, lon, landingBase.lat, landingBase.lon);
      const distInNm = greatCircleDistanceNm(lat, lon, landingBase.lat, landingBase.lon);
      const groundSpeedIn = Math.max(1, windCorrectedGroundSpeedKt(trueAirspeedKt, windSpeedKt, windFromDeg, bearingIn));
      const timeInHr = distInNm / groundSpeedIn;

      const totalTimeHr = timeOutHr + timeInHr;
      if (totalTimeHr < minTotalTimeHr) {
        minTotalTimeHr = totalTimeHr;
      }
    }
  }

  // Mümkün olan en kısa rotanın süresi bütçeden küçük veya eşitse nokta kapsama alanındadır
  return minTotalTimeHr <= timeBudgetHr;
}

// Bounding box wide enough to contain the largest possible envelope (a generous
// upper bound on reach, using the best-case tailwind ground speed).
function computeCoverageBounds(bases, trueAirspeedKt, windSpeedKt, timeBudgetHr) {
  const maxRadiusNm = timeBudgetHr * (trueAirspeedKt + windSpeedKt) * 1.15;
  const avgLat = bases.reduce((sum, b) => sum + b.lat, 0) / bases.length;
  const latPadDeg = maxRadiusNm / 60, lonPadDeg = maxRadiusNm / (60 * Math.cos(toRad(avgLat)));
  return {
    south: Math.min(...bases.map(b => b.lat)) - latPadDeg, north: Math.max(...bases.map(b => b.lat)) + latPadDeg,
    west: Math.min(...bases.map(b => b.lon)) - lonPadDeg, east: Math.max(...bases.map(b => b.lon)) + lonPadDeg
  };
}

const COVERAGE_GRID_COLS = 600;

/* ============================================== Akainami 2026 =========
   MARCHING SQUARES - Izgara Matrisini Pürüzsüz Kontura Çevirir
   ============================================== Akainami 2026 ========= */
function getIsoContour(grid, cols, rows, bounds) {
  const getLat = r => bounds.north - (r / (rows - 1)) * (bounds.north - bounds.south);
  const getLon = c => bounds.west + (c / (cols - 1)) * (bounds.east - bounds.west);

  const segments = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      // 2x2 hücre bloğunun değerleri
      const tl = grid[r * cols + c];
      const tr = grid[r * cols + (c + 1)];
      const br = grid[(r + 1) * cols + (c + 1)];
      const bl = grid[(r + 1) * cols + c];

      const cellIndex = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (cellIndex === 0 || cellIndex === 15) continue;

      const top    = [getLat(r), getLon(c + 0.5)];
      const right  = [getLat(r + 0.5), getLon(c + 1)];
      const bottom = [getLat(r + 1), getLon(c + 0.5)];
      const left   = [getLat(r + 0.5), getLon(c)];

      switch (cellIndex) {
        case 1:  case 14: segments.push([left, bottom]); break;
        case 2:  case 13: segments.push([bottom, right]); break;
        case 3:  case 12: segments.push([left, right]); break;
        case 4:  case 11: segments.push([top, right]); break;
        case 5:           segments.push([top, left], [bottom, right]); break;
        case 10:          segments.push([top, right], [bottom, left]); break;
        case 6:  case 9:  segments.push([top, bottom]); break;
        case 7:  case 8:  segments.push([top, left]); break;
      }
    }
  }

  if (segments.length === 0) return [];

  // Parçaları uç uca birleştirip kapalı poligon hattı oluşturur
  const points = [segments[0][0], segments[0][1]];
  const used = new Uint8Array(segments.length);
  used[0] = 1;

  for (let iter = 0; iter < segments.length; iter++) {
    const last = points[points.length - 1];
    let found = false;
    for (let i = 0; i < segments.length; i++) {
      if (used[i]) continue;
      const [p1, p2] = segments[i];
      if (Math.hypot(last[0] - p1[0], last[1] - p1[1]) < 0.0001) {
        points.push(p2);
        used[i] = 1;
        found = true;
        break;
      } else if (Math.hypot(last[0] - p2[0], last[1] - p2[1]) < 0.0001) {
        points.push(p1);
        used[i] = 1;
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  return points;
}

/* ============================================== Akainami 2026 =========
   VEKTÖREL (SVG) COVERAGE RENDER
   ============================================== Akainami 2026 ========= */
function renderCoverageOverlay(bases, trueAirspeedKt, windSpeedKt, windFromDeg, timeBudgetHr) {
  const bounds = computeCoverageBounds(bases, trueAirspeedKt, windSpeedKt, timeBudgetHr);
  const cols = COVERAGE_GRID_COLS, rows = Math.max(60, Math.min(400, Math.round(cols * (bounds.north - bounds.south) / (bounds.east - bounds.west))));
  const covered = new Uint8Array(cols * rows);
  let coveredCellCount = 0;

  for (let row = 0; row < rows; row++) {
    const lat = bounds.north - (row / (rows - 1)) * (bounds.north - bounds.south);
    for (let col = 0; col < cols; col++) {
      const lon = bounds.west + (col / (cols - 1)) * (bounds.east - bounds.west);
      if (isPointCovered(lat, lon, bases, trueAirspeedKt, windSpeedKt, windFromDeg, timeBudgetHr)) { 
        covered[row * cols + col] = 1; 
        coveredCellCount++; 
      }
    }
  }

  // Izgaradan vektör koordinat noktalarını çıkar
  const contourPoints = getIsoContour(covered, cols, rows, bounds);

  // SVG Poligon çizen Leaflet katmanı
  if (contourPoints.length > 0) {
    L.polygon(contourPoints, {
      color: "#3de6c8",       // Çerçeve Rengi
      weight: 2,              // Çerçeve Kalınlığı
      fillColor: "#33e6a0",   // Dolgu Rengi
      fillOpacity: 0.3,       // Dolgu Şeffaflığı
      smoothFactor: 1.2,      // Leaflet'in otomatik yumuşatması (0 = yumuşatma yok)
      interactive: false
    }).addTo(overlayGroup);
  }

  const avgLat = bases.reduce((sum, b) => sum + b.lat, 0) / bases.length;
  const cellWidthNm = ((bounds.east - bounds.west) / cols) * 60 * Math.cos(toRad(avgLat)), cellHeightNm = ((bounds.north - bounds.south) / rows) * 60;
  return { bounds, coverageAreaNm2: coveredCellCount * cellWidthNm * cellHeightNm };
}

/* ============================================== Akainami 2026 =========
   APPLICATION STATE
   ============================================== Akainami 2026 ========= */
let bases = [
  { icao: "LTFM", name: "Istanbul", lat: 41.2753, lon: 28.7519 },
  { icao: "LTAC", name: "Ankara", lat: 40.1281, lon: 32.9950 },
  { icao: "LTAN", name: "Konya", lat: 37.9836, lon: 32.5769 }
];

/* ============================================== Akainami 2026 =========
   MAP SETUP
   ============================================== Akainami 2026 ========= */
const map = L.map("map", { zoomControl: true, attributionControl: true}).setView([39.5, 32.5], 6);

const tileLayers = {
  google: L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { subdomains: ["mt0", "mt1", "mt2", "mt3"], maxZoom: 20, attribution: "Map data \u00a9 Google" }),
  osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { subdomains: ["a", "b", "c"], maxZoom: 19, attribution: "\u00a9 OpenStreetMap contributors" })
};
tileLayers.google.addTo(map);
document.getElementById("map").classList.add("leaflet-tactical");

document.getElementById("layerToggle").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const key = button.dataset.layer;
  if (key === "skyvector") {
    showError("SkyVector does not provide a generic tile service: SkyVector account/URL Template is required for map layer. Add your SkyVector TMS/WMS address to tileLayers object withing the code.");
    return;
  }
  Object.values(tileLayers).forEach(layer => map.hasLayer(layer) && map.removeLayer(layer));
  tileLayers[key].addTo(map);
  document.querySelectorAll("#layerToggle button").forEach(b => b.classList.remove("active"));
  button.classList.add("active");
});

let overlayGroup = L.layerGroup().addTo(map);

function createBaseIcon() {
  return L.divIcon({ className: "", html: `<div class="base-marker" style="width:16px;height:16px;background:#0a1420;border:2px solid var(--cyan);"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
}

/* ============================================== Akainami 2026 =========
   RUNWAY TABLE (rendering + CRUD)
   ============================================== Akainami 2026 ========= */
function renderBasesTable() {
  const tbody = document.getElementById("basesTbody");
  tbody.innerHTML = "";
  bases.forEach((base, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input data-f="icao" value="${base.icao}" style="width:56px;"></td>
      <td><input data-f="name" value="${base.name}"></td>
      <td><input data-f="lat" type="number" step="0.0001" value="${base.lat}" style="width:66px;"></td>
      <td><input data-f="lon" type="number" step="0.0001" value="${base.lon}" style="width:66px;"></td>
      <td><button class="icon-btn" data-del="${index}">✕</button></td>`;
    tr.querySelectorAll("input").forEach(input => input.addEventListener("input", () => {
      const field = input.dataset.f;
      bases[index][field] = (field === "lat" || field === "lon") ? Number(input.value) : input.value.toUpperCase();
      recalculate();
    }));
    tr.querySelector("[data-del]").addEventListener("click", () => { bases.splice(index, 1); renderBasesTable(); recalculate(); });
    tbody.appendChild(tr);
  });
}

document.getElementById("addBaseBtn").addEventListener("click", () => { bases.push({ icao: "NEW" + bases.length, name: "New Airbase", lat: 39.0, lon: 33.0 }); renderBasesTable(); recalculate(); });

/* ============================================== Akainami 2026 =========
   ERROR BANNER
   ============================================== Akainami 2026 ========= */
function showError(message) { const el = document.getElementById("errorBanner"); el.textContent = message; el.style.display = "block"; }
function clearError() { document.getElementById("errorBanner").style.display = "none"; }

/* ============================================== Akainami 2026 =========
   MAIN RECALCULATION - reads inputs, builds the coverage envelope,
   redraws the map and the results readout.
   ============================================== Akainami 2026 ========= */
function recalculate() {
  clearError();
  overlayGroup.clearLayers();

  if (bases.length === 0) { showError("Define at least one airbase."); return; }

  const missionDistanceNm = Number(document.getElementById("missionDistanceNm").value);
  const cruiseAltitudeFt = Number(document.getElementById("cruiseAltitudeFt").value);
  const cruiseKcas = Number(document.getElementById("cruiseKcas").value);
  const deltaIsaC = Number(document.getElementById("deltaIsaC").value);
  const windSpeedKt = Number(document.getElementById("windSpeedKt").value);
  const windFromDeg = ((Number(document.getElementById("windFromDeg").value) % 360) + 360) % 360;

  if (![missionDistanceNm, cruiseAltitudeFt, cruiseKcas, deltaIsaC, windSpeedKt].every(Number.isFinite)) { showError("Please provide valid numerical inputs for all of mission parameters."); return; }

  let atmosphereResult;
  try { atmosphereResult = kcasToTrueAirspeed(cruiseAltitudeFt, deltaIsaC, cruiseKcas); }
  catch (err) { showError(err.message); return; }
  const trueAirspeedKt = atmosphereResult.trueAirspeedKt;
  if (windSpeedKt >= trueAirspeedKt) { showError("Wind speed exceeds KTAS: effective range is partially invalid for some directions."); return; }

  const timeBudgetHr = missionDistanceNm / trueAirspeedKt;
  const coverage = renderCoverageOverlay(bases, trueAirspeedKt, windSpeedKt, windFromDeg, timeBudgetHr);

  bases.forEach(base => L.marker([base.lat, base.lon], { icon: createBaseIcon() })
    .addTo(overlayGroup)
    .bindTooltip(base.icao, { permanent: true, direction: "top", offset: [0, -6], className: "map-label" })
    .bindPopup(`<b>${base.icao}</b> — ${base.name}<br>${base.lat.toFixed(4)}, ${base.lon.toFixed(4)}`));

  document.getElementById("resultsBox").innerHTML =
    readoutRow("Cruise TAS / MACH", `${trueAirspeedKt.toFixed(1)} kt / ${atmosphereResult.mach.toFixed(3)}`) +
    readoutRow("Time Budget (D/TAS)", formatHm(timeBudgetHr)) +
    readoutRow("Zero-wind range reference (D)", `${missionDistanceNm.toFixed(0)} NM`) +
    readoutRow("Covered airbases", `${bases.length}`) +
    readoutRow("Coverage Area (estimated)", `${coverage.coverageAreaNm2.toFixed(0)} NM² / ${(coverage.coverageAreaNm2 * 3.4299).toFixed(0)} km²`);

 // map.fitBounds([[coverage.bounds.south, coverage.bounds.west], [coverage.bounds.north, coverage.bounds.east]], { padding: [20, 20] });
}

function readoutRow(label, value) { return `<div class="readout"><span class="k">${label}</span><span class="v">${value}</span></div>`; }
function formatHm(hours) { const h = Math.floor(hours), m = Math.round((hours - h) * 60); return `${h}sa ${String(m).padStart(2, "0")}dk`; }

/* ============================================== Akainami 2026 =========
   LIVE RECALCULATION ON INPUT CHANGE
   ============================================== Akainami 2026 ========= */
["missionDistanceNm", "cruiseAltitudeFt", "cruiseKcas", "deltaIsaC", "windSpeedKt", "windFromDeg"].forEach(id => document.getElementById(id).addEventListener("input", recalculate));

/* ============================================== Akainami 2026 =========
   UTC CLOCK
   ============================================== Akainami 2026 ========= */
function tickClock() { document.getElementById("clock").textContent = new Date().toISOString().substr(11, 8) + "Z"; }
setInterval(tickClock, 1000); tickClock();

/* ============================================== Akainami 2026 =========
   INITIALIZE
   ============================================== Akainami 2026 ========= */
renderBasesTable();
recalculate();