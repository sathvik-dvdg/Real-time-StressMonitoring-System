import { useState } from "react";
import { Link } from "react-router-dom";
import ProfileMenu from "./ProfileMenu"; // <-- 1. Import the new component

const Navbar = () => {
  const [open, setOpen] = useState(false);

  // Close the mobile menu when a link is clicked
  const handleLinkClick = () => {
    setOpen(false);
  };

  return (
    <div className="w-full h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shadow-sm bg-white">
      {/* logo */}
      <Link to="/" className="flex items-center gap-4 text-2xl font-bold">
        <span>Stress Detector</span>
      </Link>
      
      {/*mobile menu*/}
      <div className="md:hidden">
        {/* mobile button*/}
        <div
          className="cursor-pointer text-4xl"
          onClick={() => {
            setOpen((prev) => !prev);
          }}
        >
          {open ? "X" : "="}
        </div>
        
        {/* mobile linked list */}
        <div
          className={`w-full h-screen flex flex-col items-center justify-center absolute top-16 left-0 bg-white transition-all ease-in-out duration-300 z-50 gap-8 ${
            open ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
          onClick={handleLinkClick} // Close menu if background is clicked
        >
          <Link to="/" onClick={handleLinkClick}>Home</Link>
          <Link to="/" onClick={handleLinkClick}>Current scenarios</Link>
          <Link to="/" onClick={handleLinkClick}>Objective</Link>
          <Link to="/" onClick={handleLinkClick}>About</Link>
          
          {/* 2. Replace the static login button with the dynamic ProfileMenu */}
          <ProfileMenu />
          
        </div>
      </div>
      
      {/* Desktop Menu */}
      <div className="hidden md:flex items-center gap-8 xl:gap-12 font-medium">
        <Link to="/">Home</Link>
        <Link to="/">Current scenarios</Link>
        <Link to="/">Objective</Link>
        <Link to="/">About</Link>
        
        {/* 3. Replace the static login button here too */}
        <ProfileMenu />
        
      </div>
    </div>
  );
};
export default Navbar;