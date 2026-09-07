// ============================================================
// CONSTANTS
// ============================================================

const p0 = 101325;
const T0 = 288.15;
const a0_knots = 661.479;

// Search bounds of the atmosphere model (metres, pressure altitude)
const MODEL_MIN_M = -700;
const MODEL_MAX_M = 49999; // model upper bound is 50000 m, exclusive


// ============================================================
// mirror(22077 UDSE) ATMOSPHERE
// Returns { delta, geoAltM, oatK } for a given pressure altitude (m)
// and DISA (°C), or null if outside the model's defined range.
// ============================================================

function computeAtmosphere(pressAltM, disaC) {

    let delta, geoAltM, oatK;

    // Layer 1: -700 m to 11000 m
    if (pressAltM >= -700 && pressAltM < 11000) {

        delta = (1 / p0) * Math.pow(
            8.9619638 + (-0.20216125e-3) * pressAltM,
            5.2558797
        );

        geoAltM = pressAltM + disaC * (
            -153.84615 * Math.log(1 - 22.557696e-6 * pressAltM)
        );

        oatK = 288.15 - 6.5e-3 * pressAltM + disaC;

    }

    // Layer 2: 11000 m to 20000 m
    else if (pressAltM >= 11000 && pressAltM < 20000) {

        delta = (1 / p0) * 128244.5 * Math.exp(-0.15768852e-3 * pressAltM);

        geoAltM = pressAltM + disaC * (
            -6.8965165 + 4.6157397e-3 * pressAltM
        );

        oatK = 216.65 + disaC;

    }

    // Layer 3: 20000 m to 32000 m
    else if (pressAltM >= 20000 && pressAltM < 32000) {

        delta = (1 / p0) * Math.pow(
            0.70551848 + 3.5876861e-6 * pressAltM,
            -34.163218
        );

        geoAltM = pressAltM + disaC * (
            85.418277 + 1000 * Math.log(0.9076852 + 4.6157397e-6 * pressAltM)
        );

        oatK = 196.65 + 1e-3 * pressAltM + disaC;

    }

    // Layer 4: 32000 m to 47000 m
    else if (pressAltM >= 32000 && pressAltM < 47000) {

        delta = (1 / p0) * Math.pow(
            0.34926867 + 7.0330980e-6 * pressAltM,
            -12.201149
        );

        geoAltM = pressAltM + disaC * (
            139.32758 + 357.14286 * Math.log(0.6081347 + 12.245791e-6 * pressAltM)
        );

        oatK = 139.05 + 2.8e-3 * pressAltM + disaC;

    }

    // Layer 5: 47000 m to 50000 m
    else if (pressAltM >= 47000 && pressAltM < 50000) {

        delta = (1 / p0) * 41828.420 * Math.exp(-0.12622656e-3 * pressAltM);

        geoAltM = pressAltM + disaC * (
            25.898003 + 3.6948088e-3 * pressAltM
        );

        oatK = 270.65 + disaC;

    }

    // Outside UDSE range
    else {
        return null;
    }

    return { delta, geoAltM, oatK };
}


// ============================================================
// KCAS -> MACH (at a given local static pressure p)
// Mirrors the "KCAS / KIAS INPUT" branch of the atmosphere tool.
// ============================================================

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


// ============================================================
// MACH -> KCAS (at a given local static pressure p)
// Mirrors the "MACH INPUT" branch of the atmosphere tool.
// Used only to sanity-check the solved crossover point.
// ============================================================

function kcasFromMach(machVal, p) {

    const delta = p / p0;

    let Pp;

    if (machVal >= 1) {

        Pp = p * Math.pow(1.2 * machVal * machVal, 3.5) *
            Math.pow(1 + (7 / 6) * (machVal * machVal - 1), -2.5);

    } else {

        Pp = p * Math.pow(1 + 0.2 * machVal * machVal, 3.5);

    }

    const k = (Pp - p) / p0;

    let kcas;

    if (k >= 0.89293 && machVal >= 1) {

        kcas = a0_knots * Math.sqrt(0.41726 + 0.7767 * k - 0.0989 / k);

    } else if (k < 0.89293 && machVal >= 1) {

        kcas = a0_knots * Math.sqrt(5 * (
            Math.pow(
                delta * (
                    Math.pow(1.2 * machVal * machVal, 3.5) *
                    Math.pow(1 + (7 / 6) * (machVal * machVal - 1), -2.5) - 1
                ) + 1,
                2 / 7
            ) - 1
        ));

    } else {

        kcas = a0_knots * Math.sqrt(5 * (
            Math.pow(
                delta * (
                    Math.pow(machVal * machVal / 5 + 1, 3.5) - 1
                ) + 1,
                1 / 3.5
            ) - 1
        ));

    }

    return kcas;
}


// ============================================================
// CROSSOVER SOLVER
// Finds the pressure altitude (m) at which flying at targetCas
// produces exactly targetMach. Pressure altitude does not depend
// on DISA in this model, so DISA is not needed for the search.
// ============================================================

function findCrossoverPressAltM(targetCas, targetMach) {

    function machAt(h) {
        const atm = computeAtmosphere(h, 0);
        if (!atm) return null;
        return machFromKcas(targetCas, p0 * atm.delta);
    }

    let lo = MODEL_MIN_M;
    let hi = MODEL_MAX_M;

    const mLo = machAt(lo);
    const mHi = machAt(hi);

    if (mLo === null || mHi === null || !Number.isFinite(mLo) || !Number.isFinite(mHi)) {
        return { error: "Could not evaluate the atmosphere model for these inputs." };
    }

    if (targetMach <= mLo) {
        return {
            error:
                "Target Mach is already met (or exceeded) at the lowest modeled altitude " +
                "(-700 m) for this CAS. There is no crossover altitude in range."
        };
    }

    if (targetMach >= mHi) {
        return {
            error:
                "Target Mach is not reached even at the top of the modeled range " +
                "(50,000 m) for this CAS. There is no crossover altitude in range."
        };
    }

    // Bisection: for fixed CAS, Mach increases monotonically with pressure altitude.
    let loVal = lo, hiVal = hi;

    for (let i = 0; i < 60; i++) {

        const mid = (loVal + hiVal) / 2;
        const mMid = machAt(mid);

        if (mMid < targetMach) {
            loVal = mid;
        } else {
            hiVal = mid;
        }
    }

    return { pressAltM: (loVal + hiVal) / 2 };
}


// ============================================================
// MAIN FUNCTION
// ============================================================

function calculate() {

    const targetCas = Number(document.getElementById("targetCas").value);
    const targetMach = Number(document.getElementById("targetMach").value);
    const disaC = Number(document.getElementById("disa").value);

    const error = document.getElementById("error");
    error.style.display = "none";

    if (!Number.isFinite(targetCas) || targetCas <= 0) {
        showError("Please enter a valid target CAS (kt), greater than 0.");
        return;
    }

    if (!Number.isFinite(targetMach) || targetMach <= 0) {
        showError("Please enter a valid target Mach number, greater than 0.");
        return;
    }

    if (!Number.isFinite(disaC)) {
        showError("Please enter a valid Delta ISA.");
        return;
    }

    const result = findCrossoverPressAltM(targetCas, targetMach);

    if (result.error) {
        showError(result.error);
        return;
    }

    const pressAltM = result.pressAltM;
    const atm = computeAtmosphere(pressAltM, disaC);

    const delta = atm.delta;
    const p = p0 * delta;
    const oatK = atm.oatK;
    const oatC = oatK - 273.15;
    const theta = oatK / 288.15;
    const sigma = delta / theta;

    const a_knots = a0_knots * Math.sqrt(theta);

    const machCheck = machFromKcas(targetCas, p);
    const kcasCheck = kcasFromMach(targetMach, p);

    const ktas = targetMach * a_knots;
    const keas = targetMach * a_knots * Math.sqrt(sigma);

    const pressAltFt = pressAltM / 0.3048;
    const geoAltFt = atm.geoAltM / 0.3048;

    // --------------------------------------------------------
    // DISPLAY
    // --------------------------------------------------------

    document.getElementById("pressAltFt").textContent =
        pressAltFt.toFixed(0) + " ft";

    document.getElementById("pressAltM").textContent =
        pressAltM.toFixed(0) + " m";

    document.getElementById("geoAltFt").textContent =
        geoAltFt.toFixed(0) + " ft";

    document.getElementById("pressure").textContent =
        (p / 1000).toFixed(3) + " kPa";

    document.getElementById("oat").textContent =
        oatC.toFixed(2) + " °C";

    document.getElementById("sigma").textContent =
        sigma.toFixed(6);

    document.getElementById("speedOfSound").textContent =
        a_knots.toFixed(2) + " kt";

    document.getElementById("machOut").textContent =
        machCheck.toFixed(5);

    document.getElementById("kcasOut").textContent =
        kcasCheck.toFixed(2) + " kt";

    document.getElementById("ktas").textContent =
        ktas.toFixed(2) + " kt";

    document.getElementById("keas").textContent =
        keas.toFixed(2) + " kt";
}


// ============================================================
// ERROR FUNCTION
// ============================================================

function showError(message) {
    const error = document.getElementById("error");
    error.textContent = message;
    error.style.display = "block";
}


// ============================================================
// LIVE AUTO-CALCULATION
// ============================================================

["targetCas", "targetMach", "disa"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", calculate);
});


// ============================================================
// INITIAL CALCULATION
// ============================================================

calculate();
