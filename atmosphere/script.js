// ============================================================
// CONSTANTS
// ============================================================

const p0 = 101325;

const T0 = 288.15;

const rho0 = 1.225;

const a0_knots = 661.479;

const a0_mePerSec = 340.294;


// ============================================================
// MAIN FUNCTION
// ============================================================

function calculate() {


    // --------------------------------------------------------
    // Read inputs
    // --------------------------------------------------------

    const pressAltFt =
        Number(
            document.getElementById(
                "pressureAltitude"
            ).value
        );


    const disaC =
        Number(
            document.getElementById(
                "disa"
            ).value
        );


    const val =
        Number(
            document.getElementById(
                "airspeedValue"
            ).value
        );


    const type =
        document.getElementById(
            "airspeedType"
        ).value
        .toLowerCase();


    // --------------------------------------------------------
    // Validate
    // --------------------------------------------------------

    const error =
        document.getElementById("error");


    error.style.display = "none";


    if (!Number.isFinite(pressAltFt)) {

        showError(
            "Please enter a valid pressure altitude."
        );

        return;
    }


    if (!Number.isFinite(disaC)) {

        showError(
            "Please enter a valid Delta ISA."
        );

        return;
    }


    if (!Number.isFinite(val)) {

        showError(
            "Please enter a valid airspeed."
        );

        return;
    }


    // --------------------------------------------------------
    // Convert pressure altitude to meters
    // --------------------------------------------------------

    const pressAltM =
        0.3048 * pressAltFt;


    // --------------------------------------------------------
    // Variables
    // --------------------------------------------------------

    let delta;

    let geoAltM;

    let oatK;


    // ========================================================
    // mirror(22077 UDSE) ATMOSPHERE
    // ========================================================


    // --------------------------------------------------------
    // Layer 1
    // -700 m to 11000 m
    // --------------------------------------------------------

    if (
        pressAltM >= -700 &&
        pressAltM < 11000
    ) {

        delta =
            (1 / p0) *
            Math.pow(
                8.9619638 +
                (-0.20216125e-3) *
                pressAltM,
                5.2558797
            );


        geoAltM =
            pressAltM +
            disaC *
            (
                -153.84615 *
                Math.log(
                    1 -
                    22.557696e-6 *
                    pressAltM
                )
            );


        oatK =
            288.15 -
            6.5e-3 *
            pressAltM +
            disaC;
    }


    // --------------------------------------------------------
    // Layer 2
    // 11000 m to 20000 m
    // --------------------------------------------------------

    else if (
        pressAltM >= 11000 &&
        pressAltM < 20000
    ) {

        delta =
            (1 / p0) *
            128244.5 *
            Math.exp(
                -0.15768852e-3 *
                pressAltM
            );


        geoAltM =
            pressAltM +
            disaC *
            (
                -6.8965165 +
                4.6157397e-3 *
                pressAltM
            );


        oatK =
            216.65 +
            disaC;
    }


    // --------------------------------------------------------
    // Layer 3
    // 20000 m to 32000 m
    // --------------------------------------------------------

    else if (
        pressAltM >= 20000 &&
        pressAltM < 32000
    ) {

        delta =
            (1 / p0) *
            Math.pow(
                0.70551848 +
                3.5876861e-6 *
                pressAltM,
                -34.163218
            );


        geoAltM =
            pressAltM +
            disaC *
            (
                85.418277 +
                1000 *
                Math.log(
                    0.9076852 +
                    4.6157397e-6 *
                    pressAltM
                )
            );


        oatK =
            196.65 +
            1e-3 *
            pressAltM +
            disaC;
    }


    // --------------------------------------------------------
    // Layer 4
    // 32000 m to 47000 m
    // --------------------------------------------------------

    else if (
        pressAltM >= 32000 &&
        pressAltM < 47000
    ) {

        delta =
            (1 / p0) *
            Math.pow(
                0.34926867 +
                7.0330980e-6 *
                pressAltM,
                -12.201149
            );


        geoAltM =
            pressAltM +
            disaC *
            (
                139.32758 +
                357.14286 *
                Math.log(
                    0.6081347 +
                    12.245791e-6 *
                    pressAltM
                )
            );


        oatK =
            139.05 +
            2.8e-3 *
            pressAltM +
            disaC;
    }


    // --------------------------------------------------------
    // Layer 5
    // 47000 m to 50000 m
    // --------------------------------------------------------

    else if (
        pressAltM >= 47000 &&
        pressAltM < 50000
    ) {

        delta =
            (1 / p0) *
            41828.420 *
            Math.exp(
                -0.12622656e-3 *
                pressAltM
            );


        geoAltM =
            pressAltM +
            disaC *
            (
                25.898003 +
                3.6948088e-3 *
                pressAltM
            );


        oatK =
            270.65 +
            disaC;
    }


    // --------------------------------------------------------
    // Outside UDSE range
    // --------------------------------------------------------

    else {

        showError(
            "Pressure altitude is outside definition range (-700 m to 50000 m)."
        );

        return;
    }


    // ========================================================
    // ATMOSPHERIC PARAMETERS
    // ========================================================

    const pressure =
        p0 * delta;


    const p =
        pressure;


    const geoAltFt =
        geoAltM / 0.3048;


    const oatC =
        oatK - 273.15;


    const theta =
        oatK / 288.15;


    const sigma =
        delta / theta;


    const rho =
        1.225 * sigma;


    // Dynamic viscosity

    const mu =
        0.00000145743 *
        Math.pow(
            theta * 288.16,
            1.5
        ) /
        (
            theta * 288.16 +
            110.4
        );


    // Speed of sound

    const a_knots =
        a0_knots *
        Math.sqrt(theta);


    const a_mePerSec =
        a0_mePerSec *
        Math.sqrt(theta);


    // ========================================================
    // AIRSPEED CALCULATIONS
    // ========================================================

    let mach;

    let ktas;

    let keas;

    let kcas;


    // --------------------------------------------------------
    // MACH INPUT
    // --------------------------------------------------------

    if (type === "mach") {

        mach = val;


        let Pp;


        if (mach >= 1) {

            Pp =
                p *
                Math.pow(
                    1.2 * mach * mach,
                    3.5
                ) *
                Math.pow(
                    1 +
                    (7 / 6) *
                    (mach * mach - 1),
                    -2.5
                );

        }
        else {

            Pp =
                p *
                Math.pow(
                    1 +
                    0.2 * mach * mach,
                    3.5
                );

        }


        const k =
            (Pp - p) / p0;


        if (
            k >= 0.89293 &&
            mach >= 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    0.41726 +
                    0.7767 * k -
                    0.0989 / k
                );

        }


        else if (
            k < 0.89293 &&
            mach >= 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    5 *
                    (
                        Math.pow(
                            delta *
                            (
                                Math.pow(
                                    1.2 *
                                    mach *
                                    mach,
                                    3.5
                                ) *
                                Math.pow(
                                    1 +
                                    (7 / 6) *
                                    (
                                        mach *
                                        mach -
                                        1
                                    ),
                                    -2.5
                                ) -
                                1
                            ) +
                            1,
                            2 / 7
                        ) -
                        1
                    )
                );

        }


        else if (
            k < 0.89293 &&
            mach < 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    5 *
                    (
                        Math.pow(
                            delta *
                            (
                                Math.pow(
                                    mach * mach / 5 + 1,
                                    3.5
                                ) -
                                1
                            ) +
                            1,
                            1 / 3.5
                        ) -
                        1
                    )
                );

        }


        ktas =
            mach *
            a_knots;


        keas =
            mach *
            a_knots *
            Math.sqrt(sigma);

    }


    // --------------------------------------------------------
    // KCAS / KIAS INPUT
    // --------------------------------------------------------

    else if (
        type === "kcas" ||
        type === "kias"
    ) {

        kcas = val;


        let Pp_p;


        if (
            kcas / a0_knots <= 1
        ) {

            Pp_p =
                (p0 / p) *
                (
                    Math.pow(
                        1 +
                        0.2 *
                        Math.pow(
                            kcas / a0_knots,
                            2
                        ),
                        3.5
                    ) -
                    1
                ) +
                1;

        }
        else {

            Pp_p =
                (p0 / p) *
                (
                    Math.pow(
                        1.2 *
                        Math.pow(
                            kcas / a0_knots,
                            2
                        ),
                        3.5
                    ) *
                    Math.pow(
                        1 +
                        (7 / 6) *
                        (
                            Math.pow(
                                kcas / a0_knots,
                                2
                            ) -
                            1
                        ),
                        -2.5
                    ) -
                    1
                ) +
                1;

        }


        if (
            kcas / a0_knots > 1 &&
            Pp_p > 1.89293
        ) {

            mach =
                Math.sqrt(
                    0.41726 +
                    0.7767 *
                    (Pp_p - 1) -
                    0.0989 /
                    (Pp_p - 1)
                );

        }


        else if (
            kcas / a0_knots <= 1 &&
            Pp_p > 1.89293
        ) {

            mach =
                Math.sqrt(
                    0.41726 +
                    0.7767 *
                    (Pp_p - 1) -
                    0.0989 /
                    (Pp_p - 1)
                );

        }


        else if (
            kcas / a0_knots <= 1 &&
            Pp_p < 1.89293
        ) {

            mach =
                Math.sqrt(
                    5 *
                    (
                        Math.pow(
                            Pp_p,
                            2 / 7
                        ) -
                        1
                    )
                );

        }


        ktas =
            mach *
            a_knots;


        keas =
            mach *
            a_knots *
            Math.sqrt(sigma);

    }


    // --------------------------------------------------------
    // KTAS INPUT
    // --------------------------------------------------------

    else if (type === "ktas") {

        ktas = val;


        mach =
            ktas /
            a_knots;


        keas =
            mach *
            a_knots *
            Math.sqrt(sigma);


        let Pp;


        if (mach >= 1) {

            Pp =
                p *
                Math.pow(
                    1.2 *
                    mach *
                    mach,
                    3.5
                ) *
                Math.pow(
                    1 +
                    (7 / 6) *
                    (
                        mach *
                        mach -
                        1
                    ),
                    -2.5
                );

        }
        else {

            Pp =
                p *
                Math.pow(
                    1 +
                    0.2 *
                    mach *
                    mach,
                    3.5
                );

        }


        const k =
            (Pp - p) /
            p0;


        if (
            k >= 0.89293 &&
            mach >= 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    0.41726 +
                    0.7767 * k -
                    0.0989 / k
                );

        }


        else if (
            k < 0.89293 &&
            mach >= 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    5 *
                    (
                        Math.pow(
                            delta *
                            (
                                Math.pow(
                                    1.2 *
                                    mach *
                                    mach,
                                    3.5
                                ) *
                                Math.pow(
                                    1 +
                                    (7 / 6) *
                                    (
                                        mach *
                                        mach -
                                        1
                                    ),
                                    -2.5
                                ) -
                                1
                            ) +
                            1,
                            2 / 7
                        ) -
                        1
                    )
                );

        }


        else if (
            k < 0.89293 &&
            mach <= 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    5 *
                    (
                        Math.pow(
                            delta *
                            (
                                Math.pow(
                                    mach *
                                    mach /
                                    5 +
                                    1,
                                    3.5
                                ) -
                                1
                            ) +
                            1,
                            1 / 3.5
                        ) -
                        1
                    )
                );

        }

    }


    // --------------------------------------------------------
    // KEAS INPUT
    // --------------------------------------------------------

    else if (type === "keas") {

        keas = val;


        mach =
            keas /
            (
                a_knots *
                Math.sqrt(sigma)
            );


        ktas =
            mach *
            a_knots;


        let Pp;


        if (mach >= 1) {

            Pp =
                p *
                Math.pow(
                    1.2 *
                    mach *
                    mach,
                    3.5
                ) *
                Math.pow(
                    1 +
                    (7 / 6) *
                    (
                        mach *
                        mach -
                        1
                    ),
                    -2.5
                );

        }
        else {

            Pp =
                p *
                Math.pow(
                    1 +
                    0.2 *
                    mach *
                    mach,
                    3.5
                );

        }


        const k =
            (Pp - p) /
            p0;


        if (
            k >= 0.89293 &&
            mach >= 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    0.41726 +
                    0.7767 * k -
                    0.0989 / k
                );

        }


        else if (
            k < 0.89293 &&
            mach >= 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    5 *
                    (
                        Math.pow(
                            delta *
                            (
                                Math.pow(
                                    1.2 *
                                    mach *
                                    mach,
                                    3.5
                                ) *
                                Math.pow(
                                    1 +
                                    (7 / 6) *
                                    (
                                        mach *
                                        mach -
                                        1
                                    ),
                                    -2.5
                                ) -
                                1
                            ) +
                            1,
                            2 / 7
                        ) -
                        1
                    )
                );

        }


        else if (
            k < 0.89293 &&
            mach <= 1
        ) {

            kcas =
                a0_knots *
                Math.sqrt(
                    5 *
                    (
                        Math.pow(
                            delta *
                            (
                                Math.pow(
                                    mach *
                                    mach /
                                    5 +
                                    1,
                                    3.5
                                ) -
                                1
                            ) +
                            1,
                            1 / 3.5
                        ) -
                        1
                    )
                );

        }

    }


    // ========================================================
    // TOTAL AIR TEMPERATURE
    // ========================================================

    const Tt_K =
        oatK *
        (
            1 +
            0.2 *
            mach *
            mach
        );


    const Tt_C =
        Tt_K -
        273.15;


    // ========================================================
    // DYNAMIC PRESSURE
    // ========================================================

    const qbar =
        0.5 *
        1.225 *
        Math.pow(
            keas * 1852 / 3600,
            2
        );


    // ========================================================
    // REYNOLDS NUMBER PER METRE
    // ========================================================

    const rePerMet =
        ktas *
        rho *
        1852 / 3600 /
        mu;


    // ========================================================
    // CONVERT KNOTS TO m/s
    // ========================================================

    const cas =
        kcas *
        1852 / 3600;


    const tas =
        ktas *
        1852 / 3600;


    const eas =
        keas *
        1852 / 3600;


    // ========================================================
    // DISPLAY
    // ========================================================

    document.getElementById("pressure")
        .textContent =
        (
            pressure / 1000
        ).toFixed(3)
        + " kPa";


    document.getElementById("oat")
        .textContent =
        oatC.toFixed(2)
        + " °C";


    document.getElementById("oat2")
        .textContent =
        oatC.toFixed(2)
        + " °C";


    document.getElementById("geoAlt")
        .textContent =
        geoAltFt.toFixed(1)
        + " ft";


    document.getElementById("density")
        .textContent =
        rho.toFixed(5)
        + " kg/m³";


    document.getElementById("sigma")
        .textContent =
        sigma.toFixed(6);


    document.getElementById("mu")
        .textContent =
        mu.toExponential(5)
        + " kg/(m·s)";


    document.getElementById("mach")
        .textContent =
        mach.toFixed(5);


    document.getElementById("kcas")
        .textContent =
        kcas.toFixed(2)
        + " kt";


    document.getElementById("ktas")
        .textContent =
        ktas.toFixed(2)
        + " kt";


    document.getElementById("keas")
        .textContent =
        keas.toFixed(2)
        + " kt";


    document.getElementById("tas")
        .textContent =
        tas.toFixed(2)
        + " m/s";


    document.getElementById("cas")
        .textContent =
        cas.toFixed(2)
        + " m/s";


    document.getElementById("tat")
        .textContent =
        Tt_C.toFixed(2)
        + " °C";


    document.getElementById("theta")
        .textContent =
        theta.toFixed(6);


    document.getElementById("qbar")
        .textContent =
        qbar.toFixed(2)
        + " Pa";


    document.getElementById("rePerMet")
        .textContent =
        rePerMet.toExponential(5)
        + " 1/m";


    document.getElementById("speedOfSound")
        .textContent =
        a_knots.toFixed(2)
        + " kt";


}


// ============================================================
// ERROR FUNCTION
// ============================================================

function showError(message) {

    const error =
        document.getElementById("error");

    error.textContent = message;

    error.style.display = "block";

}


// ============================================================
// LIVE AUTO-CALCULATION
// ============================================================
// Recalculate automatically whenever any input or select changes,
// instead of requiring a button click.

[
    "pressureAltitude",
    "disa",
    "airspeedValue"
].forEach(function (id) {

    document.getElementById(id)
        .addEventListener("input", calculate);

});


document.getElementById("airspeedType")
    .addEventListener("change", calculate);


// ============================================================
// INITIAL CALCULATION
// ============================================================

calculate();
