// We only need to import 'db' directly.
// 'app' and 'getFirestore' are handled in firebaseConfig.js.
import { db } from "./firebaseconfig";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; // Only import what's directly used

export const saveStressScore = async (sessionData) => {
  if (!sessionData || !sessionData.userId) {
    console.error("User not logged in or userId missing. Cannot save session data.");
    return null; // Return null on error for better handling
  }

  // Basic validation for required fields
  if (sessionData.averageScore === undefined || !sessionData.scores || !sessionData.sessionId) {
      console.error("Missing required session data (averageScore, scores, sessionId). Cannot save.");
      return null;
  }

  try {
    // Correctly reference the 'sessions' subcollection under a specific user
    const userSessionsCollectionRef = collection(db, `users/${sessionData.userId}/sessions`);

    const docRef = await addDoc(userSessionsCollectionRef, {
      // No need to store userId inside the document if it's already part of the path
      sessionId: sessionData.sessionId, // This could be auto-generated later if needed
      averageScore: sessionData.averageScore,
      scores: sessionData.scores, // This should be an array of individual scores captured
      timestamp: serverTimestamp(), // Use Firestore's server timestamp for consistency
    });

    console.log("Session data for user", sessionData.userId, "written with ID: ", docRef.id);
    return docRef.id; // Return the ID of the new document for potential frontend use
  } catch (e) {
    console.error("Error adding session document: ", e);
    return null; // Return null on error
  }
};