// frontend/src/components/WebCamCapture.jsx
import React, { useState, useEffect, useRef } from 'react';

const WebcamCapture = () => {
    // A ref to hold a reference to the video element
    const videoRef = useRef(null);
    // A ref to hold the webcam stream so we can stop it later
    const streamRef = useRef(null);

    // Use state to track if the webcam has started
    const [webcamStarted, setWebcamStarted] = useState(false);

    // useEffect to handle starting and stopping the webcam stream
    useEffect(() => {
        // This function runs once when the component mounts
        const startWebcam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream; // Save the stream to the ref
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setWebcamStarted(true);
            } catch (error) {
                console.error('Error accessing webcam:', error);
                alert('Could not access the webcam. Please check permissions.');
            }
        };

        startWebcam();

        // Cleanup function to stop the stream when the component unmounts
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []); // Empty dependency array means this runs once on mount

    // Function to capture the frame and log the image data
    const captureAndLogFrame = () => {
        if (!videoRef.current || !webcamStarted) {
            console.log("Webcam not ready or not started.");
            return;
        }

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Set canvas dimensions to match the video feed
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the current video frame onto the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get the Base64-encoded image data from the canvas
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        // Log the image data to the console
        console.log("Captured Image Data (Base64):", imageData);
        console.log("Now you can copy this string and paste it into Postman.");
    };

    return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <h1>Webcam Frame Capture</h1>
            <p>Click the button to log the webcam image data to the console.</p>

            <div style={{ border: '2px solid black', display: 'inline-block' }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ maxWidth: '100%' }}></video>
            </div>

            <br />

            {webcamStarted ? (
                <button
                    onClick={captureAndLogFrame}
                    style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px' }}
                >
                    Capture Frame
                </button>
            ) : (
                <p style={{ marginTop: '20px', color: 'gray' }}>Waiting for webcam access...</p>
            )}
        </div>
    );
};

export default WebcamCapture;