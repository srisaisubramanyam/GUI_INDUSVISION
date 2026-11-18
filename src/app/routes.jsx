import Login from "../pages/Login.jsx";
import Code from "../pages/Code.jsx";
import Camera from "../pages/Camera.jsx";
import Diagnosis from "../pages/Diagnosis.jsx";
import DefectToggles from "../pages/DefectToggles.jsx";
import DataCollection from "../pages/DataCollection.jsx";
import Admin from "../pages/Admin.jsx";
import Profile from "../pages/Profile.jsx";

export const routes = [
  { path: "/", element: <Login /> },
  { path: "/admin", element: <Admin /> },
  { path: "/code", element: <Code /> },
  { path: "/camera", element: <Camera /> },
  { path: "/diagnosis", element: <Diagnosis /> },
  { path: "/defects", element: <DefectToggles /> },
  { path: "/data", element: <DataCollection /> },
  { path: "/profile", element: <Profile /> },
];
