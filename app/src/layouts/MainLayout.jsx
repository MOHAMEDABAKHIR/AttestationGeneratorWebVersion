import { Outlet } from "react-router-dom";
import HomePage from "../pages/HomePage";
import logomL from "../assets/logomL.png";
function MainLayout() {
  return (
    <>
      <div className=" flex border-b-1 border-[#133458] pt-3">
        <h2 className="text-[#133458] text-3xl font-mono flex-1">
          Plateforme de génération des attestations
        </h2>
      </div>

      <Outlet>
        <HomePage />
      </Outlet>
      <div className="fixed bottom-0 left-0 w-full flex justify-center p-5 ">
        <img src={logomL} className="w-40 opacity-15 " />
      </div>
    </>
  );
}

export default MainLayout;
