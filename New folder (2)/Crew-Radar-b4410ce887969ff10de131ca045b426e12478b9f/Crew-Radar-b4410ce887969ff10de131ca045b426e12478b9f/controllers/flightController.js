

const axios = require("axios");
const User = require("../models/User");
const Follow = require("../models/Follow");
const { sendFlightNotification } = require("../services/sendFlightNotification");

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


exports.triggerFlightNotification = async (req, res) => {
    try {
        const { userId, flight } = req.body;
        console.log(req.body, "req.body");
       
        if (!userId) {
            return res.status(400).json({ status: false, message: "User ID is required." });
        }
 
        // Find the user who should receive notifications
        const notificationReceiver = await User.findOneAndUpdate(
        { _id: userId },
        { $set: { isNotify: true } },
        { new: true }
        );
 
        const follow = await Follow.findOne({
        following: userId,
        status: "accepted"
        })
        .sort({ createdAt: 1 }) // earliest (first) follower
        .select("follower -_id");
       
        const pilotId = follow?.follower.toString();
       
        console.log(pilotId);
       
        const pilot = await User.findById(pilotId).select("fullName");
 
        const pilotName = pilot?.fullName;
 
        console.log(pilotName,"pilotName");
 
        if (!notificationReceiver) {
        return res.status(404).json({ status: false, message: "User not found." });
        }
 
        // Determine which flights to process
        let flightsToProcess = [];
        if (flight && Array.isArray(flight) && flight.length > 0) {
            flightsToProcess = flight;
        } else {
            return res.status(200).json({
                status: false,
                message: "No flight numbers provided."
            });
        }
 
        // Check if the user has firebaseToken
        if (!notificationReceiver.firebaseToken) {
            return res.status(400).json({
                status: false,
                message: "User does not have a valid firebaseToken for notifications."
            });
        }
 
        let notificationsSent = 0;
        let flightDetails = [];
        const now = new Date();
 
        const today = new Date().toISOString().slice(0, 10);
        const fromDate = `${today}T00:00:00Z`;
        const toDate = `${today}T23:59:59Z`;
 
        for (const flightCode of flightsToProcess) {
            const flightUpper = flightCode.trim().toUpperCase();
            console.log(flightUpper,"flightUpper");
            const fr24Url = `https://fr24api.flightradar24.com/api/flight-summary/full?flights=${flightUpper}&flight_datetime_from=${fromDate}&flight_datetime_to=${toDate}`;
 
            try {
                const response = await axios.get(fr24Url, {
                    headers: {
                        Authorization: `Bearer ${process.env.FR24_API_KEY}`,
                        Accept: "application/json",
                        "Accept-Version": "v1",
                    },
                    timeout: 10000
                });
 
                const rawData = response.data?.data;
                const flightsArray = Array.isArray(rawData) ? rawData : (rawData ? [rawData] : []);
                console.log(flightsArray,"flightsArray")
 
                // Find specific flight match
                const flightData = flightsArray.find(f => f.flight?.trim().toUpperCase() === flightUpper);
                 console.log(flightData,"flightData")
                if (flightData) {
                    // Process takeoff event
                    if (flightData.datetime_takeoff) {
                        const takeoffTime = new Date(flightData.datetime_takeoff);
                        const takeoffTimeStr = takeoffTime.toISOString();
                       
                        // Check if takeoff is within 2 minutes
                        const takeoffDiffMinutes = (now - takeoffTime) / (1000 * 60);
                        const isTakeoffRecent = takeoffDiffMinutes >= 0 && takeoffDiffMinutes <= 2;
                        console.log(isTakeoffRecent,"isTakeoffRecent")
                        // Send notification for takeoff if within 2 minutes
 
                        // follower,    
                        // status,      
                        // timeStr,      
                        // pilotId,      
                        // pilotName,    
                        // fcmToken,    
                        // flightNumber
                        if (isTakeoffRecent) {
                            await sendFlightNotification(
                                notificationReceiver,
                                "takeoff",
                                takeoffTimeStr,
                                pilotId, // No pilot ID needed since sending directly to user
                                pilotName,
                                notificationReceiver.firebaseToken,
                                flightUpper
                            );
                            notificationsSent++;
                            flightDetails.push({
                                flight: flightUpper,
                                event: "takeoff",
                                time: takeoffTimeStr,
                                notified: true
                            });
                        } else {
                            flightDetails.push({
                                flight: flightUpper,
                                event: "takeoff",
                                time: takeoffTimeStr,
                                notified: false,
                                reason: "Outside 2-minute window"
                            });
                        }
                    }
 
                    // Process landing event
                    if (flightData.datetime_landed) {
                        const landingTime = new Date(flightData.datetime_landed);
                        const landingTimeStr = landingTime.toISOString();
                       
                        // Check if landing is within 2 minutes
                        const landingDiffMinutes = (now - landingTime) / (1000 * 60);
                        const isLandingRecent = landingDiffMinutes >= 0 && landingDiffMinutes <= 10;
                       
                        // Send notification for landing if within 2 minutes
                        if (isLandingRecent) {
                            await sendFlightNotification(
                                notificationReceiver,
                                "landing",
                                landingTimeStr,
                                pilotId,
                                pilotName,
                                notificationReceiver.firebaseToken,
                                flightUpper
                            );
                            notificationsSent++;
                            flightDetails.push({
                                flight: flightUpper,
                                event: "landing",
                                time: landingTimeStr,
                                notified: true
                            });
                        } else {
                            flightDetails.push({
                                flight: flightUpper,
                                event: "landing",
                                time: landingTimeStr,
                                notified: false,
                                reason: "Outside 2-minute window"
                            });
                        }
                    }
                   
                    // If no events found for this flight
                    if (!flightData.datetime_takeoff && !flightData.datetime_landed) {
                        flightDetails.push({
                            flight: flightUpper,
                            notified: false,
                            reason: "No takeoff or landing data available"
                        });
                    }
 
                } else {
                    // No flight data found
                    flightDetails.push({
                        flight: flightUpper,
                        notified: false,
                        reason: "Flight not found in API response"
                    });
                }
 
            } catch (err) {
                console.error(`Error fetching FR24 for ${flightUpper}:`, err.message);
                flightDetails.push({
                    flight: flightUpper,
                    notified: false,
                    reason: `API Error: ${err.message}`
                });
            }
        }
 
        return res.status(200).json({
            status: true,
            message: `Processed ${flightsToProcess.length} flight(s). Sent ${notificationsSent} notification(s).`,
            user: {
                id: notificationReceiver._id,
                name: notificationReceiver.fullName,
                email: notificationReceiver.email
            },
            notificationsSent,
            flightDetails,
            totalFlights: flightsToProcess.length
        });
 
    } catch (error) {
        console.error("Trigger Error:", error.message);
        return res.status(500).json({
            status: false,
            error: error.message
        });
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




