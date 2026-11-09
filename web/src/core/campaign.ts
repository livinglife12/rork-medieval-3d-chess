import type { Difficulty } from "./types";
import type { ArmySkinId } from "../assets/generated";

/** A campaign node is data, not UI, so it can later drive a map or multiplayer room. */
export interface CampaignMission {
  id: string;
  title: string;
  description: string;
  legion: ArmySkinId;
  opponent: ArmySkinId;
  difficulty: Difficulty;
  unlockAfter?: string;
}

export interface CampaignProgress {
  completed: string[];
  selectedMission: string;
}

export const CAMPAIGN_MISSIONS: readonly CampaignMission[] = [
  {
    id: "frostborn-awakening",
    title: "The Frostborn Awakening",
    description: "Hold the mountain pass and claim the first banner of the northern clans.",
    legion: "viking",
    opponent: "sun",
    difficulty: "easy",
  },
  {
    id: "storm-on-the-temple",
    title: "Storm on the Temple",
    description: "Break through the Sun Empire before the storm closes the valley.",
    legion: "viking",
    opponent: "sun",
    difficulty: "medium",
    unlockAfter: "frostborn-awakening",
  },
  {
    id: "iron-and-ice",
    title: "Iron and Ice",
    description: "Defeat the Grande Armée in a battle of steel, powder and frozen ground.",
    legion: "viking",
    opponent: "empire",
    difficulty: "hard",
    unlockAfter: "storm-on-the-temple",
  },
];

const STORAGE_KEY = "kg.campaign.v1";
const DEFAULT_PROGRESS: CampaignProgress = {
  completed: [],
  selectedMission: CAMPAIGN_MISSIONS[0].id,
};

export function loadCampaignProgress(): CampaignProgress {
  if (typeof window === "undefined") return { ...DEFAULT_PROGRESS, completed: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, completed: [] };
    const value = JSON.parse(raw) as Partial<CampaignProgress>;
    const completed = Array.isArray(value.completed)
      ? value.completed.filter((id): id is string => typeof id === "string")
      : [];
    const selectedMission = CAMPAIGN_MISSIONS.some((mission) => mission.id === value.selectedMission)
      ? value.selectedMission!
      : DEFAULT_PROGRESS.selectedMission;
    return { completed, selectedMission };
  } catch {
    return { ...DEFAULT_PROGRESS, completed: [] };
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private browsing or storage limits: campaign remains playable this session.
  }
}

export function isMissionUnlocked(mission: CampaignMission, progress: CampaignProgress): boolean {
  return !mission.unlockAfter || progress.completed.includes(mission.unlockAfter);
}

export function completeMission(progress: CampaignProgress, missionId: string): CampaignProgress {
  if (progress.completed.includes(missionId)) return progress;
  const next = { ...progress, completed: [...progress.completed, missionId] };
  saveCampaignProgress(next);
  return next;
}

/** The mission the menu should open on: the first unlocked one not yet won, else the last unlocked. */
export function nextMission(progress: CampaignProgress): CampaignMission {
  const unlocked = CAMPAIGN_MISSIONS.filter((mission) => isMissionUnlocked(mission, progress));
  const remembered = unlocked.find((mission) => mission.id === progress.selectedMission);
  const pending = unlocked.find((mission) => !progress.completed.includes(mission.id));
  if (remembered && !progress.completed.includes(remembered.id)) return remembered;
  return pending ?? unlocked[unlocked.length - 1] ?? CAMPAIGN_MISSIONS[0];
}

export function selectMission(progress: CampaignProgress, missionId: string): CampaignProgress {
  const next = { ...progress, selectedMission: missionId };
  saveCampaignProgress(next);
  return next;
}

/** One line for the game-over card after a campaign battle. */
export function missionOutcomeNote(missionId: string, won: boolean, draw: boolean): string {
  const index = CAMPAIGN_MISSIONS.findIndex((mission) => mission.id === missionId);
  if (index < 0) return "";
  if (!won) return draw ? "The field is held, not won. Fight again to claim it." : "The chapter stands unconquered.";
  const following = CAMPAIGN_MISSIONS[index + 1];
  return following ? `Chapter won. Unlocked: ${following.title}.` : "The campaign is complete. The north is yours.";
}
