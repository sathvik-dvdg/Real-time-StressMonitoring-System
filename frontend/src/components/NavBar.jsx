import { useState } from "react";
import { NavLink } from "react-router-dom"; // 💥 1. Import NavLink instead of Link
import ProfileMenu from "./ProfileMenu";

// 💥 2. Define our navigation links as an array (cleaner code)
const navLinks = [
  { name: "Home", href: "/" },
  { name: "Current scenarios", href: "/scenarios" },
  { name: "Objective", href: "/objective" },
  { name: "About", href: "/about" },
];

// 3. Define the styling for active vs. inactive links
const getLinkClass = ({ isActive }) => {
  return `transition-colors duration-200 ${
    isActive
      ? "text-indigo-600 font-bold border-b-2 border-indigo-600" // Active link style
      : "text-gray-600 hover:text-indigo-600" // Inactive link style
  }`;
};

const Navbar = () => {
  const [open, setOpen] = useState(false);

  // Close the mobile menu when a link is clicked
  const handleLinkClick = () => {
    setOpen(false);
  };

  return (
    <div className="w-full h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shadow-sm bg-white sticky top-0 z-50">
      {/* logo */}
      <NavLink to="/" className="flex items-center gap-4 text-2xl font-bold text-gray-900">
        <span>Stress Detector</span>
      </NavLink>
      
      {/* mobile menu */}
      <div className="md:hidden">
        {/* mobile button (Hamburger Icon) */}
        <button
          className="cursor-pointer text-3xl text-gray-800"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {open ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          )}
        </button>
        
        {/* mobile linked list */}
        <div
          className={`w-full h-screen flex flex-col items-center justify-center fixed top-16 left-0 bg-white transition-all ease-in-out duration-300 z-40 gap-8 ${
            open ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
          onClick={handleLinkClick} // Close menu if background is clicked
        >
          {navLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.href}
              className={getLinkClass} // Use the same style function
              onClick={handleLinkClick}
            >
              {link.name}
            </NavLink>
          ))}
          
          <div className="mt-4">
            <ProfileMenu />
          </div>
        </div>
      </div>
      
      {/* Desktop Menu */}
      <div className="hidden md:flex items-center gap-8 xl:gap-12 font-medium">
        {navLinks.map((link) => (
          <NavLink
            key={link.name}
            to={link.href}
            className={getLinkClass} // Use the style function
          >
            {link.name}
          </NavLink>
        ))}
        
        <ProfileMenu />
      </div>
    </div>
  );
};
export default Navbar;