import React from "react";
import SidebarLayout from "../layout/Sidebar";

const Dashboard = () => {
  return (
    <SidebarLayout>
      <div className="text-2xl font-bold">Welcome to Dashboard!</div>
      <p className="mt-4">
        This is where your main content will go.
      </p>
    </SidebarLayout>
  );
};

export default Dashboard;
