

// const axios = require("axios");
// const User = require("../models/User");

// exports.triggerFlightNotification = async (req, res) => {
//     try {
//         const { userId } = req.body;
//         if (!userId) {
//             return res.status(400).json({ status: false, message: "User ID is required." });
//         }

//         const pilot = await User.findById(userId);
//         if (!pilot) {
//             return res.status(404).json({ status: false, message: "Pilot not found." });
//         }

//         if (!pilot.flightNumber || pilot.flightNumber.length === 0) {
//             return res.status(200).json({ status: false, message: "Pilot has no flight numbers configured." });
//         }


//         let newStatuses = [];
//         let newTimes = [];
//         let hasLiveFlight = false;

//         const today = new Date().toISOString().slice(0, 10);
//         const fromDate = `${today}T00:00:00`;
//         const toDate = `${today}T23:59:59`;


//         for (const flightCode of pilot.flightNumber) {
//             const flightUpper = flightCode.trim().toUpperCase();
//             const fr24Url = `https://fr24api.flightradar24.com/api/flight-summary/full?flights=${flightUpper}&flight_datetime_from=${fromDate}&flight_datetime_to=${toDate}`;

//             try {
//                 const response = await axios.get(fr24Url, {
//                     headers: {
//                         Authorization: `Bearer ${process.env.FR24_API_KEY}`,
//                         Accept: "application/json",
//                         "Accept-Version": "v1",
//                     },
//                 });

//                 const rawData = response.data?.data;
//                 const flightsArray = Array.isArray(rawData) ? rawData : (rawData ? [rawData] : []);

//                 // Find specific flight match
//                 const flightData = flightsArray.find(f => f.flight?.trim().toUpperCase() === flightUpper);

//                 if (flightData) {

//                     hasLiveFlight = true;
//                     const takeoff = flightData.datetime_takeoff ? new Date(flightData.datetime_takeoff).toISOString() : "";
//                     const landed = flightData.datetime_landed ? new Date(flightData.datetime_landed).toISOString() : "";

//                     // Push Takeoff Data
//                     newStatuses.push("takeoff");
//                     newTimes.push(takeoff);

//                     // Push Landing Data (only if different or valid)
//                     newStatuses.push("landing");
//                     newTimes.push(landed);
//                 } else {

//                     newStatuses.push("no_data");
//                     newTimes.push("");
//                 }

//             } catch (err) {
//                 console.error(`Error fetching FR24 for ${flightUpper}:`, err.message);
//                 newStatuses.push("error");
//                 newTimes.push("");
//             }
//         }


//         pilot.flightStatus = newStatuses;
//         pilot.flightDateTime = newTimes;
//         await pilot.save();

//         return res.status(200).json({
//             status: true,
//             message: hasLiveFlight ? "Flight data updated." : "No live flights found today. Data cleared.",
//             pilot
//         });

//     } catch (error) {
//         console.error(" Trigger Error:", error.message);
//         return res.status(500).json({ status: false, error: error.message });
//     }
// };


// exports.forceFlightTest = async (req, res) => {
//     try {
//         const { userId } = req.body;
//         const pilot = await User.findById(userId);

//         if (!pilot) return res.status(404).json({ message: "Pilot not found" });
//         const now = new Date();
//         const twoMinutesLater = new Date(now.getTime() + 2 * 60000).toISOString();
//         pilot.flightDateTime = [
//             twoMinutesLater, 
//             ""               
//         ];
//         pilot.flightStatus = ["takeoff", "landing"];

//         await pilot.save();

//         console.log(" TEST MODE: Flight time updated to NOW. Wait for Cron...");

//         return res.status(200).json({
//             status: true,
//             message: "Flight time updated to NOW. Notification should arrive in 1-2 minutes.",
//             updatedPilot: pilot
//         });
//     } catch (error) {
//         return res.status(500).json({ error: error.message });
//     }
// };






const axios = require("axios");
const User = require("../models/User");

// Helper to check basic IATA format (2 chars + digits)
const isValidFlightFormat = (flight) => {
    const regex = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/; 
    return regex.test(flight);
};

exports.triggerFlightNotification = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ status: false, message: "User ID is required." });
        }

        const pilot = await User.findById(userId);
        if (!pilot) {
            return res.status(404).json({ status: false, message: "Pilot not found." });
        }

        if (!pilot.flightNumber || pilot.flightNumber.length === 0) {
            return res.status(200).json({ status: false, message: "Pilot has no flight numbers configured." });
        }

        // -----------------------------------------------------
        // 1️⃣ PREPARE FLIGHTS (Split commas & Clean)
        // -----------------------------------------------------
        // Turns ["U2ESBY, U2214"] into ["U2ESBY", "U2214"]
        const allFlights = pilot.flightNumber
            .flatMap(f => f.split(","))
            .map(f => f.trim().toUpperCase())
            .filter(f => f.length > 0);

        // -----------------------------------------------------
        // 2️⃣ DEFINE DATE RANGE (Today)
        // -----------------------------------------------------
        const today = new Date().toISOString().slice(0, 10);
        const fromDate = `${today}T00:00:00`;
        const toDate = `${today}T23:59:59`;

        let finalStatuses = [];
        let finalTimes = [];
        let successFlights = [];
        let failedFlights = [];

        // -----------------------------------------------------
        // 3️⃣ FETCH DATA IN PARALLEL (Process Valid & Invalid separately)
        // -----------------------------------------------------
        await Promise.all(allFlights.map(async (flight) => {
            
            // A. Basic Regex Check (Save API calls for obvious junk)
            if (!isValidFlightFormat(flight)) {
                console.log(`⚠️ Skipped invalid format: ${flight}`);
                failedFlights.push({ flight, reason: "Invalid IATA format" });
                return; 
            }

            // B. Call API individually
            const fr24Url = `https://fr24api.flightradar24.com/api/flight-summary/full?flights=${flight}&flight_datetime_from=${fromDate}&flight_datetime_to=${toDate}`;

            try {
                const response = await axios.get(fr24Url, {
                    headers: {
                        Authorization: `Bearer ${process.env.FR24_API_KEY}`,
                        Accept: "application/json",
                        "Accept-Version": "v1",
                    },
                });

                const rawData = response.data?.data;
                const flightsArray = Array.isArray(rawData) ? rawData : (rawData ? [rawData] : []);
                
                // Find specific flight match
                const flightData = flightsArray.find(f => f.flight?.trim().toUpperCase() === flight);

                if (flightData) {
                    // ✅ SUCCESS: Flight has data
                    successFlights.push(flight);

                    // Add Takeoff
                    if (flightData.datetime_takeoff) {
                        finalStatuses.push("takeoff");
                        finalTimes.push(new Date(flightData.datetime_takeoff).toISOString());
                    } else {
                        // Optional: Keep structure if needed, or skip
                        // finalStatuses.push("scheduled"); 
                        // finalTimes.push(""); 
                    }

                    // Add Landing
                    if (flightData.datetime_landed) {
                        finalStatuses.push("landing");
                        finalTimes.push(new Date(flightData.datetime_landed).toISOString());
                    }
                } else {
                    // ⚠️ Valid format, but no flight today (e.g. not flying today)
                    failedFlights.push({ flight, reason: "No live data today" });
                    
                    // Push a placeholder so Cron knows we checked but found nothing
                    finalStatuses.push("no_data");
                    finalTimes.push(""); 
                }

            } catch (err) {
                // ❌ API ERROR (e.g., 400 Validation Failed from FR24)
                // We catch it here so the loop CONTINUES for other flights
                console.error(`❌ Error for ${flight}: ${err.response?.data?.message || err.message}`);
                failedFlights.push({ flight, reason: "API Error / Invalid Code" });
                
                finalStatuses.push("error");
                finalTimes.push("");
            }
        }));

        // -----------------------------------------------------
        // 4️⃣ UPDATE DB
        // -----------------------------------------------------
        // Only update if we actually checked something
        pilot.flightStatus = finalStatuses;
        pilot.flightDateTime = finalTimes;

        await pilot.save();

        return res.status(200).json({
            status: true,
            message: "Flight check complete.",
            results: {
                updated: successFlights,
                skipped: failedFlights
            },
            data: {
                status: finalStatuses,
                times: finalTimes
            }
        });

    } catch (error) {
        console.error("❌ System Error:", error.message);
        return res.status(500).json({ status: false, error: error.message });
    }
};

 exports.forceFlightTest = async (req, res) => {
    try {
        const { userId } = req.body;
        const pilot = await User.findById(userId);

        if (!pilot) return res.status(404).json({ message: "Pilot not found" });
        const now = new Date();
        const twoMinutesLater = new Date(now.getTime() + 2 * 60000).toISOString();
        pilot.flightDateTime = [
            twoMinutesLater, 
            ""               
        ];
        pilot.flightStatus = ["takeoff", "landing"];

        await pilot.save();

        console.log(" TEST MODE: Flight time updated to NOW. Wait for Cron...");

        return res.status(200).json({
            status: true,
            message: "Flight time updated to NOW. Notification should arrive in 1-2 minutes.",
            updatedPilot: pilot
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};