import { useState } from "react";
import { Check, Clapperboard, Crown, Swords, Settings as SettingsIcon, Users, Map } from "lucide-react";

import type { DemoOptions, Difficulty, Faction } from "../core/types";
import { ARMY_SKINS } from "../assets/generated";
import { Crest } from "./Heraldry";
import { useHasKeyboard } from "./inputMode";
import { MusterSection, type MusterChoice } from "./Muster";
import {
  CAMPAIGN_MISSIONS,
  isMissionUnlocked,
  loadCampaignProgress,
  nextMission,
  selectMission,
  type CampaignMission,
} from "../core/campaign";

export interface MatchConfig {
  mode: "ai" | "hotseat" | "demo";
  difficulty: Difficulty;
  playerColor: Faction;
  clockMinutes: number | null;
  demo?: DemoOptions;
  campaignMission?: CampaignMission;
}

interface MainMenuProps {
  onStart: (config: MatchConfig) => void;
  onOpenSettings: () => void;
  /** Armies and battleground — settled here, before the first move. */
  muster: MusterChoice;
  onMuster: (choice: MusterChoice) => void;
  attract: boolean;
  onInteract: () => void;
}

const DIFFICULTY_COPY: Record<Difficulty, string> = {
  easy: "Squire — plays fast and loose",
  medium: "Knight — thinks three moves deep",
  hard: "Warlord — full search, no mercy",
};

const DEMO_SPEEDS: { label: string; value: number }[] = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
];

const CLOCKS: { label: string; value: number | null }[] = [
  { label: "None", value: null },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
];

export function MainMenu({ onStart, onOpenSettings, muster, onMuster, attract, onInteract }: MainMenuProps) {
  const hasKeyboard = useHasKeyboard();
  const [tab, setTab] = useState<"ai" | "hotseat" | "demo" | "campaign">("ai");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<Faction>("w");
  const [clock, setClock] = useState<number | null>(null);
  const [demoWhite, setDemoWhite] = useState<Difficulty>("medium");
  const [demoBlack, setDemoBlack] = useState<Difficulty>("hard");
  const [demoSpeed, setDemoSpeed] = useState(1);
  const [demoLoop, setDemoLoop] = useState(true);
  const [campaignProgress, setCampaignProgress] = useState(loadCampaignProgress);
  const [campaignMission, setCampaignMission] = useState<CampaignMission>(() => nextMission(campaignProgress));
  const chooseMission = (mission: CampaignMission): void => {
    setCampaignMission(mission);
    setCampaignProgress((progress) => selectMission(progress, mission.id));
  };

  const start = (): void =>
    onStart({
      mode: tab === "campaign" ? "ai" : tab,
      difficulty: tab === "campaign" ? campaignMission.difficulty : difficulty,
      // Campaign chapters are written for the near-side legion, so the player always leads it.
      playerColor: tab === "campaign" ? "w" : playerColor,
      clockMinutes: tab === "demo" ? null : clock,
      demo: tab === "demo" ? { white: demoWhite, black: demoBlack, speed: demoSpeed, autoRematch: demoLoop } : undefined,
      campaignMission: tab === "campaign" ? campaignMission : undefined,
    });

  return (
    <div
      className="mc-menu mc-modal-pad pointer-events-auto absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      onPointerDown={onInteract}
      onPointerMove={onInteract}
    >
      <div className="mc-unfurl mc-menu-hero mb-6 shrink-0 text-center">
        <p className="mc-display text-[0.68rem] tracking-[0.55em] text-[#c8ab74]">Anno Domini MCDXCII</p>
        <h1 className="mc-display mc-title-glow mt-2 text-5xl font-bold text-[#f4e3bd] sm:text-6xl">
          KING&apos;S GAMBIT
        </h1>
        <div className="mc-rule mx-auto mt-3 w-64" />
        <p className="mt-3 text-sm italic text-[#c5b28d]">
          {attract ? "An AI vs AI duel is under way — move to take the hall" : "Chess in the great hall of Aldermoor"}
        </p>
      </div>

      <div className="mc-slate mc-goldleaf mc-rise flex w-full min-h-0 max-w-md flex-col p-5 sm:p-6">
        <div className="mb-5 grid shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-1.5 px-1 py-3"
            data-active={tab === "ai"}
            onClick={() => setTab("ai")}
          >
            <Swords size={14} /> Computer
          </button>
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-1.5 px-1 py-3"
            data-active={tab === "hotseat"}
            onClick={() => setTab("hotseat")}
          >
            <Users size={14} /> 2 Players
          </button>
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-1.5 px-1 py-3"
            data-active={tab === "demo"}
            onClick={() => setTab("demo")}
          >
            <Clapperboard size={14} /> AI vs AI
          </button>
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-1.5 px-1 py-3"
            data-active={tab === "campaign"}
            onClick={() => setTab("campaign")}
          >
            <Map size={14} /> Campaign
          </button>
        </div>

        <div className="mc-scroll -mr-2 min-h-0 flex-auto overflow-y-auto pr-2">
        {tab === "campaign" ? (
          <div className="mc-fade space-y-3">
            <p className="text-sm italic leading-relaxed text-[#b7a88a]">
              Follow the Frostborn clans through a chain of battles. Completing a mission unlocks the next chapter.
            </p>
            {CAMPAIGN_MISSIONS.map((mission) => {
              const unlocked = isMissionUnlocked(mission, campaignProgress);
              const won = campaignProgress.completed.includes(mission.id);
              return (
                <button
                  key={mission.id}
                  type="button"
                  disabled={!unlocked}
                  className="mc-chip flex w-full flex-col items-start gap-1 px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-40"
                  data-active={campaignMission.id === mission.id}
                  aria-pressed={campaignMission.id === mission.id}
                  onClick={() => chooseMission(mission)}
                >
                  <span className="mc-display flex w-full items-center justify-between gap-2">
                    {mission.title}
                    {won ? (
                      <span className="flex shrink-0 items-center gap-1 text-[0.55rem] tracking-[0.2em]">
                        <Check size={11} aria-hidden /> WON
                      </span>
                    ) : null}
                  </span>
                  <span className="font-['Crimson_Pro',Georgia,serif] text-[0.85rem] normal-case italic leading-snug tracking-normal opacity-85">
                    {mission.description}
                  </span>
                  <span className="text-[0.58rem] tracking-[0.18em] opacity-90">
                    {unlocked
                      ? `${mission.difficulty} · versus the ${ARMY_SKINS[mission.opponent].label}`
                      : "Locked — complete the previous mission"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : tab === "ai" ? (
          <div className="mc-fade space-y-5">
            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">Opponent</p>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="mc-chip py-2.5"
                    data-active={difficulty === level}
                    onClick={() => setDifficulty(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs italic text-[#9c8b6c]">{DIFFICULTY_COPY[difficulty]}</p>
            </div>

            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">Your banner</p>
              <div className="grid grid-cols-2 gap-2">
                {(["w", "b"] as Faction[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="mc-chip flex items-center justify-center gap-2 py-2.5"
                    data-active={playerColor === color}
                    onClick={() => setPlayerColor(color)}
                  >
                    <Crest faction={color} size={18} active={playerColor === color} />
                    {color === "w" ? "Ivory" : "Obsidian"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : tab === "hotseat" ? (
          <p className="mc-fade text-sm italic leading-relaxed text-[#b7a88a]">
            Two commanders, one board. The view holds its angle between turns —{" "}
            {hasKeyboard ? (
              <>
                flip it whenever you like with <span className="mc-display text-[#e2c98f]">F</span>, or
              </>
            ) : (
              <>flip it whenever you like from the camera menu, or</>
            )}{" "}
            switch on the automatic swing in settings.
          </p>
        ) : (
          <div className="mc-fade space-y-5">
            <p className="text-sm italic leading-relaxed text-[#b7a88a]">
              Two AI commanders duel on their own while the camera drifts around the hall — made for watching and for
              capturing footage.{" "}
              {hasKeyboard ? (
                <>
                  Press <span className="mc-display text-[#e2c98f]">C</span> in the match to hide the whole interface.
                </>
              ) : (
                <>Tap the clean-capture sigil in the match to hide the whole interface.</>
              )}
            </p>

            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">Ivory engine</p>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="mc-chip py-2.5"
                    data-active={demoWhite === level}
                    onClick={() => setDemoWhite(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">Obsidian engine</p>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="mc-chip py-2.5"
                    data-active={demoBlack === level}
                    onClick={() => setDemoBlack(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">Pace</p>
              <div className="grid grid-cols-4 gap-2">
                {DEMO_SPEEDS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className="mc-chip py-2.5"
                    data-active={demoSpeed === option.value}
                    onClick={() => setDemoSpeed(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="mc-chip flex w-full items-center justify-between px-3 py-2.5"
              data-active={demoLoop}
              onClick={() => setDemoLoop((loop) => !loop)}
              aria-pressed={demoLoop}
            >
              <span>Loop new duels</span>
              <span className="mc-display text-[0.62rem] tracking-[0.24em]">{demoLoop ? "ON" : "OFF"}</span>
            </button>
          </div>
        )}

        {tab === "demo" ? null : (
          <div className="mt-5">
            <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">Hourglass</p>
            <div className="grid grid-cols-4 gap-2">
              {CLOCKS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="mc-chip py-2.5"
                  data-active={clock === option.value}
                  onClick={() => setClock(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mc-rule my-5" />

        <MusterSection choice={muster} onChange={onMuster} />
        </div>

        <div className="mc-panel-foot mc-actions mt-5 shrink-0">
        <button
          type="button"
          className="mc-btn mc-btn-primary flex items-center justify-center gap-2"
          onClick={start}
        >
          {tab === "demo" ? (
            <>
              <Clapperboard size={15} /> Start AI vs AI
            </>
          ) : (
            <>
              <Crown size={15} /> Take the field
            </>
          )}
        </button>

        <button
          type="button"
          className="mc-btn flex items-center justify-center gap-2"
          onClick={onOpenSettings}
        >
          <SettingsIcon size={14} /> Settings
        </button>
        </div>
      </div>

      {/* The hall is driven differently by a finger than by a mouse, so the
          standing instruction names only the gestures this device actually has. */}
      <p className="mc-menu-hint mt-5 shrink-0 text-[0.68rem] tracking-[0.2em] text-[#7d6f57]">
        {hasKeyboard
          ? "DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A FIGURE TO COMMAND IT"
          : "DRAG TO ORBIT · PINCH TO ZOOM · TAP A FIGURE TO COMMAND IT"}
      </p>
    </div>
  );
}
