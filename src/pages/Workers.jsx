// pages/Dashboard.jsx
import React from "react";
import SidebarLayout from "../layout/sidebar";
import AddIcon from '@mui/icons-material/Add';

const Workers = () => {
  return (
    <SidebarLayout>
      <div className="text-2xl font-bold mb-5"> Welcome to Workers!</div>
       <button className="bg-emerald-400 w-[120px] h-[35px] mb-5 rounded-lg hover:bg-emerald-500 align-middle flex items-center justify-center gap-0.5 cursor-pointer transition delay-150 duration-300 ease-in-out hover:-translate-y-0.5 hover:scale-100"><AddIcon className="text-sm"/>Add Worker</button>
      <table class="bg-amber-600 rounded-2xl w-[1200px] table-fixed md:border-collapse ">
        <thead className="h-[50px]"> 
          <tr>
            <th class="text-left p-5">NAME</th>
            <th class="text-left p-5">MINISTRY</th>
            <th class="text-left p-5">CONTACT</th>
            <th class="text-left p-5">STATUS</th>
            <th class="text-left p-5">DATE ADDED</th>
            <th class="text-left p-5">ACTION</th>
          </tr>
        </thead>
        <tbody className="border-t-0 h-[50px] bg-blue-400">
            <tr>
                <th class="text-left pl-5" >John Dela Cruz</th>
                <th class="text-left pl-5">Guitarist</th>
                <th class="text-left pl-5">09971231234</th>
                <th class="text-left pl-5">Active</th>
                <th class="text-left pl-5">11/29/2025</th>
                <th class="text-left pl-5"> / or X</th>
            </tr>
        </tbody>
      </table>
    </SidebarLayout>
  );
};

export default Workers;
