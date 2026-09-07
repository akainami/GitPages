// ============================================================
// CONSTANTS - Akainami 2026
// ============================================================

const FT_PER_NM = 6076.1154855643;
const M_PER_NM = 1852;
const DEG_PER_M_LAT = 1 / 111320; // approx. meters per degree latitude

const p0 = 101325;
const a0_knots = 661.479;

let bandIdCounter = 0;


// ============================================================
// Atmosphere Model - Akainami 2026
// KCAS -> KTAS conversion requires pressure and temperature
// ============================================================

function computeAtmosphere(pressAltM, disaC) {

    let delta, oatK;

    if (pressAltM >= -700 && pressAltM < 11000) {

        delta = (1 / p0) * Math.pow(
            8.9619638 + (-0.20216125e-3) * pressAltM,
            5.2558797
        );
        oatK = 288.15 - 6.5e-3 * pressAltM + disaC;

    } else if (pressAltM >= 11000 && pressAltM < 20000) {

        delta = (1 / p0) * 128244.5 * Math.exp(-0.15768852e-3 * pressAltM);
        oatK = 216.65 + disaC;

    } else if (pressAltM >= 20000 && pressAltM < 32000) {

        delta = (1 / p0) * Math.pow(
            0.70551848 + 3.5876861e-6 * pressAltM,
            -34.163218
        );
        oatK = 196.65 + 1e-3 * pressAltM + disaC;

    } else if (pressAltM >= 32000 && pressAltM < 47000) {

        delta = (1 / p0) * Math.pow(
            0.34926867 + 7.0330980e-6 * pressAltM,
            -12.201149
        );
        oatK = 139.05 + 2.8e-3 * pressAltM + disaC;

    } else if (pressAltM >= 47000 && pressAltM < 50000) {

        delta = (1 / p0) * 41828.420 * Math.exp(-0.12622656e-3 * pressAltM);
        oatK = 270.65 + disaC;

    } else {
        return null;
    }

    return { delta, oatK };
}


function machFromKcas(kcasVal, p) {

    const ratio = kcasVal / a0_knots;

    let Pp_p;

    if (ratio <= 1) {

        Pp_p = (p0 / p) * (
            Math.pow(1 + 0.2 * Math.pow(ratio, 2), 3.5) - 1
        ) + 1;

    } else {

        Pp_p = (p0 / p) * (
            Math.pow(1.2 * Math.pow(ratio, 2), 3.5) *
            Math.pow(1 + (7 / 6) * (Math.pow(ratio, 2) - 1), -2.5) - 1
        ) + 1;

    }

    let mach;

    if (ratio > 1 && Pp_p > 1.89293) {
        mach = Math.sqrt(0.41726 + 0.7767 * (Pp_p - 1) - 0.0989 / (Pp_p - 1));
    } else if (ratio <= 1 && Pp_p > 1.89293) {
        mach = Math.sqrt(0.41726 + 0.7767 * (Pp_p - 1) - 0.0989 / (Pp_p - 1));
    } else if (ratio <= 1 && Pp_p < 1.89293) {
        mach = Math.sqrt(5 * (Math.pow(Pp_p, 2 / 7) - 1));
    } else {
        mach = NaN;
    }

    return mach;
}


// KCAS
function kcasToKtas(kcasVal, altFt, disaC) {

    const pressAltM = altFt * 0.3048;
    const atm = computeAtmosphere(pressAltM, disaC);

    if (!atm) return NaN;

    const p = p0 * atm.delta;
    const mach = machFromKcas(kcasVal, p);

    if (!Number.isFinite(mach)) return NaN;

    const theta = atm.oatK / 288.15;
    const a_knots = a0_knots * Math.sqrt(theta);

    return mach * a_knots;
}


// ============================================================
// LEAFLET MAP SETUP - Akainami 2026
// ============================================================

const map = L.map("map", { zoomControl: true }).setView([39.0, 35.0], 6);

let onlineTileLayer = null;
let localImageOverlay = null;

const planeDivIcon = L.divIcon({
    className: "",
    html:
        '<div class="plane-icon" id="planeIconInner">' +
        '<svg width="26" height="26" viewBox="0 0 24 24">' +
        '<path d="M12 2 L15 10 L22 13 L15 14.5 L14 21 L12 18.5 L10 21 L9 14.5 L2 13 L9 10 Z" ' +
        'fill="#2563eb" stroke="#1d4ed8" stroke-width="0.5"/>' +
        "</svg></div>",
    iconSize: [26, 26],
    iconAnchor: [13, 13]
});

const acftMarker = L.marker([0, 0], { icon: planeDivIcon, draggable: true }).addTo(map);

const circle = L.circle([0, 0], {
    radius: 1,
    color: "#2563eb",
    weight: 2,
    fillColor: "#2563eb",
    fillOpacity: 0.12
}).addTo(map);

const centerMarker = L.circleMarker([0, 0], {
    radius: 4,
    color: "#991b1b",
    weight: 2,
    fillColor: "#991b1b",
    fillOpacity: 1
}).addTo(map);

const driftLine = L.polyline([[0, 0], [0, 0]], {
    color: "#991b1b",
    weight: 1.5,
    dashArray: "4 4"
}).addTo(map);


function applyMapSource() {

    const source = document.getElementById("mapSource").value;
    const localGroup = document.getElementById("localMapGroup");

    if (source === "online") {

        localGroup.style.display = "none";

        if (localImageOverlay) {
            map.removeLayer(localImageOverlay);
            localImageOverlay = null;
        }

        if (!onlineTileLayer) {
            onlineTileLayer = L.tileLayer(
                // "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                // {
                //    maxZoom: 19,
                //    attribution: "&copy; OpenStreetMap contributors"
                // }
				'https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest', {
				minZoom: 4,
				maxZoom: 11, // 11'den fazla zoom yaparsanız harita tekrar griye dönebilir
				attribution: '&copy; <a href="https://openflightmaps.org" target="_blank">Open Flightmaps</a>' }
            );
        }

        onlineTileLayer.addTo(map);

    } else {

        localGroup.style.display = "block";

        if (onlineTileLayer) {
            map.removeLayer(onlineTileLayer);
        }

        const imageUrl = document.getElementById("localImageUrl").value.trim();
        const nwLat = Number(document.getElementById("nwLat").value);
        const nwLon = Number(document.getElementById("nwLon").value);
        const seLat = Number(document.getElementById("seLat").value);
        const seLon = Number(document.getElementById("seLon").value);

        if (
            !imageUrl ||
            !Number.isFinite(nwLat) || !Number.isFinite(nwLon) ||
            !Number.isFinite(seLat) || !Number.isFinite(seLon)
        ) {
            return;
        }

        const bounds = L.latLngBounds([nwLat, nwLon], [seLat, seLon]);

        if (localImageOverlay) {
            map.removeLayer(localImageOverlay);
        }

        localImageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map);
        map.fitBounds(bounds);
    }
}


// ============================================================
// Altitude blocks - Akainami 2026
// ============================================================

function addBandRow(topAltFt, glideRatio, speedKcas, windDirDeg, windSpdKt) {

    bandIdCounter++;
    const rowId = "band-" + bandIdCounter;

    const row = document.createElement("div");
    row.className = "band-row";
    row.id = rowId;

    row.innerHTML =
        '<input type="number" class="band-alt" step="100" value="' + topAltFt + '">' +
        '<input type="number" class="band-ratio" step="0.1" min="0.1" value="' + glideRatio + '">' +
        '<input type="number" class="band-speed" step="1" value="' + speedKcas + '">' +
        '<input type="number" class="band-wdir" step="1" min="0" max="359" value="' + windDirDeg + '">' +
        '<input type="number" class="band-wspd" step="1" value="' + windSpdKt + '">' +
        '<button type="button" class="remove-row-btn" title="Kaldır">&times;</button>';

    row.querySelector(".remove-row-btn").addEventListener("click", function () {
        row.remove();
        recalc();
    });

    document.getElementById("bandsContainer").appendChild(row);
}


function readBands() {

    const rows = document.querySelectorAll("#bandsContainer .band-row");
    const bands = [];

    rows.forEach(function (row) {
        bands.push({
            topAltFt: Number(row.querySelector(".band-alt").value),
            glideRatio: Number(row.querySelector(".band-ratio").value),
            speedKcas: Number(row.querySelector(".band-speed").value),
            windDirDeg: Number(row.querySelector(".band-wdir").value),
            windSpdKt: Number(row.querySelector(".band-wspd").value)
        });
    });

    bands.sort(function (a, b) {
        return a.topAltFt - b.topAltFt;
    });

    return bands;
}


// ============================================================
// Glide cone calculation - Akainami 2026
// ============================================================

function computeGlideCircle(acftAltFt, bands, disaC) {

    if (bands.length === 0) {
        return { error: "Define at least one altitude block." };
    }

    for (const b of bands) {
        if (
            !Number.isFinite(b.topAltFt) || !Number.isFinite(b.glideRatio) ||
            !Number.isFinite(b.speedKcas) || !Number.isFinite(b.windDirDeg) ||
            !Number.isFinite(b.windSpdKt) || b.glideRatio <= 0 || b.speedKcas <= 0
        ) {
            return { error: "Check the values in altitude blocks (glide ratio and airspeed shall be greater than zero)." };
        }
    }

    let bottom = 0;
    let totalDistNm = 0;
    let totalTimeHr = 0;
    let dxNm = 0; // east positive
    let dyNm = 0; // north positive

    function accumulateLayer(b, layerBottom, layerTop) {

        const thicknessFt = layerTop - layerBottom;
        if (thicknessFt <= 0) return null;

        const midAltFt = (layerBottom + layerTop) / 2;
        const ktas = kcasToKtas(b.speedKcas, midAltFt, disaC);

        if (!Number.isFinite(ktas) || ktas <= 0) {
            return {
                error:
                    "For " + midAltFt.toFixed(0) +" ft, KTAS could not be calculated for KCAS (presssure altitude interval is between -700 m and 50.000 m)."
            };
        }

        const distNm = (thicknessFt / FT_PER_NM) * b.glideRatio;
        const timeHr = distNm / ktas;
        const driftNm = b.windSpdKt * timeHr;

        // Meteorological wind direction is where wind comes from.
        // Drift direction is where wind goes to.
        const toDirRad = (((b.windDirDeg + 180) % 360) * Math.PI) / 180;

        return {
            distNm: distNm,
            timeHr: timeHr,
            dxNm: driftNm * Math.sin(toDirRad),
            dyNm: driftNm * Math.cos(toDirRad)
        };
    }

    for (const b of bands) {

        if (bottom >= acftAltFt) break;

        const top = Math.min(b.topAltFt, acftAltFt);
        const layer = accumulateLayer(b, bottom, top);

        if (layer && layer.error) return { error: layer.error };

        if (layer) {
            totalDistNm += layer.distNm;
            totalTimeHr += layer.timeHr;
            dxNm += layer.dxNm;
            dyNm += layer.dyNm;
        }

        bottom = top;
    }

    // If pressure altitude of aircraft exceeds maximum defined altitude block,
    // saturate the value as so. - Akainami 2026
    if (bottom < acftAltFt) {

        const last = bands[bands.length - 1];
        const layer = accumulateLayer(last, bottom, acftAltFt);

        if (layer && layer.error) return { error: layer.error };

        if (layer) {
            totalDistNm += layer.distNm;
            totalTimeHr += layer.timeHr;
            dxNm += layer.dxNm;
            dyNm += layer.dyNm;
        }
    }

    return {
        radiusNm: totalDistNm,
        driftNm: Math.hypot(dxNm, dyNm),
        driftBearingDeg: (Math.atan2(dxNm, dyNm) * 180 / Math.PI + 360) % 360,
        timeHr: totalTimeHr,
        dxNm: dxNm,
        dyNm: dyNm
    };
}


// ============================================================
// MAIN TRACK FUNCTION - Akainami 2026
// ============================================================

function recalc() {

    const error = document.getElementById("error");
    error.style.display = "none";

    const lat = Number(document.getElementById("lat").value);
    const lon = Number(document.getElementById("lon").value);
    const altitude = Number(document.getElementById("altitude").value);
    const heading = Number(document.getElementById("heading").value);
    const disaC = Number(document.getElementById("disa").value);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        showError("Enter a valid latitude (-90 | 90).");
        return;
    }

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        showError("Enter a valid longitude (-180 | 180).");
        return;
    }

    if (!Number.isFinite(altitude) || altitude <= 0) {
        showError("Enter a valid altitude (greater than zero).");
        return;
    }

    if (!Number.isFinite(heading)) {
        showError("Enter a valid heading.");
        return;
    }

    if (!Number.isFinite(disaC)) {
        showError("Enter a valid temperature deviation from ISA.");
        return;
    }

    const bands = readBands();
    const result = computeGlideCircle(altitude, bands, disaC);

    if (result.error) {
        showError(result.error);
        return;
    }

    // --------------------------------------------------------
    // Aircraft Icon - Akainami 2026
    // --------------------------------------------------------

    acftMarker.setLatLng([lat, lon]);

    const planeInner = document.getElementById("planeIconInner");
    if (planeInner) {
        planeInner.style.transform = "rotate(" + heading + "deg)";
    }

    // --------------------------------------------------------
    // Drift the glide cone per wind - Akainami 2026
    // --------------------------------------------------------

    const dxM = result.dxNm * M_PER_NM;
    const dyM = result.dyNm * M_PER_NM;

    const latOffsetDeg = dyM * DEG_PER_M_LAT;
    const lonOffsetDeg = dxM / (111320 * Math.cos((lat * Math.PI) / 180));

    const centerLat = lat + latOffsetDeg;
    const centerLon = lon + lonOffsetDeg;

    const radiusM = result.radiusNm * M_PER_NM;

    circle.setLatLng([centerLat, centerLon]);
    circle.setRadius(radiusM);

    centerMarker.setLatLng([centerLat, centerLon]);
    driftLine.setLatLngs([[lat, lon], [centerLat, centerLon]]);

    // --------------------------------------------------------
    // Results - Akainami 2026
    // --------------------------------------------------------

    document.getElementById("radiusOut").textContent =
        result.radiusNm.toFixed(2) + " NM (" + (result.radiusNm * 1.852).toFixed(2) + " km)";

    document.getElementById("driftOut").textContent =
        result.driftNm.toFixed(2) + " NM, " + result.driftBearingDeg.toFixed(0) + "°'ye doğru";

    document.getElementById("timeOut").textContent =
        (result.timeHr * 60).toFixed(1) + " dk";

    document.getElementById("acftCoordOut").textContent =
        lat.toFixed(5) + ", " + lon.toFixed(5);

    document.getElementById("centerCoordOut").textContent =
        centerLat.toFixed(5) + ", " + centerLon.toFixed(5);
}


function showError(message) {
    const error = document.getElementById("error");
    error.textContent = message;
    error.style.display = "block";
}


// ============================================================
// Location synchroniser - Akainami 2026
// ============================================================

map.on("click", function (e) {
    document.getElementById("lat").value = e.latlng.lat.toFixed(5);
    document.getElementById("lon").value = e.latlng.lng.toFixed(5);
    recalc();
});

acftMarker.on("dragend", function () {
    const p = acftMarker.getLatLng();
    document.getElementById("lat").value = p.lat.toFixed(5);
    document.getElementById("lon").value = p.lng.toFixed(5);
    recalc();
});


// ============================================================
// Event listeners - Akainami 2026
// ============================================================

document.getElementById("mapSource").addEventListener("change", function () {
    applyMapSource();
    recalc();
});

["localImageUrl", "nwLat", "nwLon", "seLat", "seLon"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
        applyMapSource();
    });
});

["lat", "lon", "altitude", "heading", "disa"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", recalc);
});

document.getElementById("bandsContainer").addEventListener("input", recalc);

document.getElementById("addBandBtn").addEventListener("click", function () {
    addBandRow(10000, 10, 75, 270, 10);
    recalc();
});


// ============================================================
// Defaults  - Akainami 2026
// ============================================================

addBandRow(5000,  12, 220, 235, 5);
addBandRow(10000, 11, 220, 235, 10);
addBandRow(20000, 10, 220, 235, 20);
addBandRow(30000, 9,  210, 235, 40);
addBandRow(40000, 8,  210, 235, 80);
							  
applyMapSource();

const initLat = Number(document.getElementById("lat").value);
const initLon = Number(document.getElementById("lon").value);
map.setView([initLat, initLon], 9);

recalc();
