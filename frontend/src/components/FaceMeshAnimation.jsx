import React from "react";
// This is the correct default import
import Lottie from "lottie-react";

// We are NOT importing the local JSON file. We are streaming it.
// This is the animation URL
const lottieUrl = "https://lottie.host/e8d949a0-143c-42b8-9b9c-f9c34f0d619f/n0wWFyE9j8.json";

/**
 * This component renders the face scan animation by streaming it from a URL.
 * It has no local dependencies and will not cause GPU crashes.
 */
function FaceMeshAnimation() {
  return (
    <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
      <div className="w-full max-w-lg opacity-30">
        <Lottie
          // Use the 'src' prop to stream from the URL
          src={lottieUrl}
          // We pass 'animationData={null}' to make sure it only uses the src
          animationData={null}
          loop={true}
          autoPlay={true}
        />
      </div>
    </div>
  );
}

export default FaceMeshAnimation;