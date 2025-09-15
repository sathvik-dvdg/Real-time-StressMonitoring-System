import { useState, useEffect } from "react";
// import { IKImage } from "imagekitio-react";
import { Link } from "react-router-dom";

// import { SignedIn, SignedOut, useAuth, UserButton } from "@clerk/clerk-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full h-16 md:h-20 flex items-center justify-between ">
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
          className={`w-full h-screen flex flex-col items-center justify-center absolute top-16 transition-all ease-in-out gap-8 ${
            open ? "-right-0" : "-right-[100%]"
          }`}
        >
          <Link to="/">Home</Link>
          <Link to="/">Current secenarios</Link>
          <Link to="/">objective</Link>
          <Link to="/">About</Link>
          <Link to="/login">
            <button className="py-2 px-4 rounded-3xl bg-blue-800 text-white">
              Login{" "}
            </button>
          </Link>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-8 xl:gap-12 font-medium">
        <Link to="/">Home</Link>
        <Link to="/">Current scenarios</Link>
        <Link to="/">objective</Link>
        <Link to="/">About</Link>
        <Link to="/login">
            <button className="py-2 px-4 rounded-3xl bg-blue-800 text-white">
              Login
            </button>
        </Link>
      </div>
    </div>
  );
};
export default Navbar;
