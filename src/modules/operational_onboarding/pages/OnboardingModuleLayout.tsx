import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import { PeopleTab } from "../components/tabs/PeopleTab";
import { TemplatesTab } from "../components/tabs/TemplatesTab";
import { TasksTab } from "../components/tabs/TasksTab";
import { SequencesTab } from "../components/tabs/SequencesTab";
import "../styles/onboarding.css";

type TabId = "people" | "templates" | "sequences" | "tasks";

export function OnboardingModuleLayout() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { hasCapability, user } = useAuth(); // or user_is_admin check

  const activeTab: TabId = (tab as TabId) || "people";

  // Simulate permission checks (replace with actual role checking logic in your app)
  const isAdmin = true; // For now, assume admin based on the initial prompt

  const handleTabChange = (newTab: TabId) => {
    navigate(`/alta-operacional/${newTab}`);
  };

  return (
    <div className="onboarding-module">
      <header className="onboarding-header">
        <div className="onboarding-title-area">
          <h1>Alta Operacional</h1>
          <span className="version-badge">v2.0</span>
        </div>
        
        <nav className="onboarding-tabs">
          <button 
            className={`tab-item ${activeTab === "people" ? "active" : ""}`}
            onClick={() => handleTabChange("people")}
          >
            👥 People
          </button>
          
          {isAdmin && (
            <button 
              className={`tab-item ${activeTab === "templates" ? "active" : ""}`}
              onClick={() => handleTabChange("templates")}
            >
              📑 Templates & Settings
            </button>
          )}

          <button 
            className={`tab-item ${activeTab === "sequences" ? "active" : ""}`}
            onClick={() => handleTabChange("sequences")}
          >
            ⏳ Sequences
          </button>

          <button 
            className={`tab-item ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => handleTabChange("tasks")}
          >
            📋 Tasks
          </button>
        </nav>
      </header>

      <main className="onboarding-content">
        {activeTab === "people" && <PeopleTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "sequences" && <SequencesTab />}
        {activeTab === "tasks" && <TasksTab />}
      </main>
    </div>
  );
}
