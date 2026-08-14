import { Skull, Users } from "lucide-react";

type RankAlignment = {
  step: number;
  creatureRank: string;
  humanTitle: string;
  humanRank: string;
  className: string;
  cores: number;
};

const RANK_ALIGNMENT: RankAlignment[] = [
  {
    step: 1,
    creatureRank: "Dormant",
    humanTitle: "Sleeper",
    humanRank: "Dormant",
    className: "Beast",
    cores: 1,
  },
  {
    step: 2,
    creatureRank: "Awakened",
    humanTitle: "Awakened",
    humanRank: "Awakened",
    className: "Monster",
    cores: 2,
  },
  {
    step: 3,
    creatureRank: "Fallen",
    humanTitle: "Master",
    humanRank: "Ascended",
    className: "Demon",
    cores: 3,
  },
  {
    step: 4,
    creatureRank: "Corrupted",
    humanTitle: "Saint",
    humanRank: "Transcendent",
    className: "Devil",
    cores: 4,
  },
  {
    step: 5,
    creatureRank: "Great",
    humanTitle: "Sovereign",
    humanRank: "Supreme",
    className: "Tyrant",
    cores: 5,
  },
  {
    step: 6,
    creatureRank: "Cursed",
    humanTitle: "Spirit",
    humanRank: "Sacred",
    className: "Terror",
    cores: 6,
  },
  {
    step: 7,
    creatureRank: "Unholy",
    humanTitle: "God",
    humanRank: "Divine",
    className: "Titan",
    cores: 7,
  },
];

const CLASS_LADDER = [
  { className: "Beast", cores: 1, summary: "Brutal, instinctive threat." },
  { className: "Monster", cores: 2, summary: "Faster growth and basic cunning." },
  { className: "Demon", cores: 3, summary: "Strategic behavior emerges." },
  { className: "Devil", cores: 4, summary: "Unnatural abilities manifest." },
  { className: "Tyrant", cores: 5, summary: "Commands lesser beings." },
  { className: "Terror", cores: 6, summary: "Influences local environment." },
  { className: "Titan", cores: 7, summary: "Calamity-scale presence." },
] as const;

export function MonsterManualTab() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-black/25 p-5 space-y-6">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Skull className="h-4 w-4 text-rose-300" />
            <h4 className="font-display text-xl text-foreground">Nightmare Creature Classes (Core Quantity)</h4>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            {CLASS_LADDER.map((entry) => {
              const width = `${Math.round((entry.cores / 7) * 100)}%`;
              return (
                <article key={entry.className} className="rounded-xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Class</p>
                  <p className="mt-1 font-display text-xl text-foreground">{entry.className}</p>
                  <p className="mt-2 text-sm text-primary">{entry.cores} Core{entry.cores > 1 ? "s" : ""}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500" style={{ width }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{entry.summary}</p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-300" />
            <h4 className="font-display text-xl text-foreground">Rank Alignment: Creatures and Humans</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-3">Step</th>
                  <th className="px-3 py-3">Nightmare Rank</th>
                  <th className="px-3 py-3">Class / Cores</th>
                  <th className="px-3 py-3">Human Title</th>
                  <th className="px-3 py-3">Human Soul Rank</th>
                </tr>
              </thead>
              <tbody>
                {RANK_ALIGNMENT.map((row) => (
                  <tr key={row.step} className="border-b border-white/5 align-top">
                    <td className="px-3 py-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
                        {row.step}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-rose-200">{row.creatureRank}</td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-semibold text-amber-200">{row.className}</p>
                      <p className="text-xs text-muted-foreground">{row.cores} Core{row.cores > 1 ? "s" : ""}</p>
                    </td>
                    <td className="px-3 py-3 font-semibold text-cyan-200">{row.humanTitle}</td>
                    <td className="px-3 py-3 text-sm text-cyan-100">{row.humanRank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
