import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_MISSIONS,
  completeMission,
  isMissionUnlocked,
  missionOutcomeNote,
  nextMission,
} from "./campaign";

describe("campaign progression", () => {
  it("starts with only the first mission unlocked", () => {
    const progress = { completed: [], selectedMission: CAMPAIGN_MISSIONS[0].id };
    expect(isMissionUnlocked(CAMPAIGN_MISSIONS[0], progress)).toBe(true);
    expect(isMissionUnlocked(CAMPAIGN_MISSIONS[1], progress)).toBe(false);
  });

  it("unlocks the next mission after a victory", () => {
    const progress = { completed: [], selectedMission: CAMPAIGN_MISSIONS[0].id };
    const next = completeMission(progress, CAMPAIGN_MISSIONS[0].id);
    expect(isMissionUnlocked(CAMPAIGN_MISSIONS[1], next)).toBe(true);
  });

  it("opens the menu on the first unwon mission", () => {
    const fresh = { completed: [], selectedMission: CAMPAIGN_MISSIONS[0].id };
    expect(nextMission(fresh).id).toBe(CAMPAIGN_MISSIONS[0].id);
    const oneWon = { completed: [CAMPAIGN_MISSIONS[0].id], selectedMission: CAMPAIGN_MISSIONS[0].id };
    expect(nextMission(oneWon).id).toBe(CAMPAIGN_MISSIONS[1].id);
    const allWon = { completed: CAMPAIGN_MISSIONS.map((m) => m.id), selectedMission: CAMPAIGN_MISSIONS[0].id };
    expect(nextMission(allWon).id).toBe(CAMPAIGN_MISSIONS[CAMPAIGN_MISSIONS.length - 1].id);
  });

  it("never opens on a locked mission", () => {
    const tampered = { completed: [], selectedMission: CAMPAIGN_MISSIONS[2].id };
    expect(nextMission(tampered).id).toBe(CAMPAIGN_MISSIONS[0].id);
  });

  it("names the unlocked chapter after a win", () => {
    expect(missionOutcomeNote(CAMPAIGN_MISSIONS[0].id, true, false)).toContain(CAMPAIGN_MISSIONS[1].title);
    expect(missionOutcomeNote(CAMPAIGN_MISSIONS[2].id, true, false)).toMatch(/complete/i);
    expect(missionOutcomeNote(CAMPAIGN_MISSIONS[0].id, false, true)).toMatch(/again/i);
  });
});
