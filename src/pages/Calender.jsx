// pages/Dashboard.jsx
import React from "react";
import SidebarLayout from "../layout/sidebar";

const Calendar = () => {
  return (
    <SidebarLayout>
      <div className="text-2xl font-bold">Welcome to Calendar!</div>
      <p className="mt-4">
        This is where your main content will go.
      </p>
    </SidebarLayout>
  );
};

export default Calendar;
