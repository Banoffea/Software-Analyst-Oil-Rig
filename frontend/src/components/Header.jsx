import React from "react";

export default function Header({ title }) {
  return (
    <header className="flex items-center justify-between p-4 sticky top-0 z-10 bg-[#111618]/80 backdrop-blur-sm">
      <div className="flex-1" />
      <h2 className="text-white text-lg font-bold flex-1 text-center">{title}</h2>
      <div className="flex-1 flex justify-end">
        <button className="flex items-center justify-center rounded-full h-10 w-10 bg-transparent text-white hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  );
}
