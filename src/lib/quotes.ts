/** Short thoughts for the Today banner. They are original lines written for this app, not attributed to anyone. One is chosen per calendar day. */
export const QUOTES: string[] = [
  "Good care starts with listening before it starts with doing.",
  "Every record is a person. Write it like someone will read it with care.",
  "A calm welcome at the front desk is the first treatment of the day.",
  "Small, consistent habits protect patients better than rare heroics.",
  "Clear instructions are a kindness. Say it simply, then check it landed.",
  "Time given to a worried patient is rarely time lost.",
  "The best handover is the one the next person never has to question.",
  "Safety is quiet work: double checks, clear labels, and speaking up.",
  "Trust is built in minutes and kept through reliable follow-through.",
  "Notice the patient who waits quietly. They are often the one who needs you most.",
  "Documentation is care that continues after the room is empty.",
  "A good question early saves a hard conversation later.",
  "Progress in health is usually a series of ordinary good days.",
  "Be gentle with the schedule and generous with the people in it.",
  "Consistency is what makes a clinic feel safe.",
  "What is explained well is followed well.",
  "Respect for privacy is part of every procedure.",
  "Teamwork turns a busy day into a manageable one.",
  "Recovery is not only the patient's work. It is the whole team's.",
  "Prevention is the patient visit that never has to happen.",
  "Pause before the next appointment. Reset, breathe, then welcome them in.",
  "A follow-up call can say more than a perfect treatment.",
  "Look at the person first and the chart second.",
  "Good clinics are built on small promises kept every day.",
  "Compassion and accuracy belong together.",
  "Ask what matters to the patient, not only what is the matter.",
  "Every well-kept appointment book is a quiet act of respect.",
  "Healing is helped by clarity, warmth and time.",
  "Make the next step obvious for every patient who leaves.",
  "Care that feels unhurried is usually well organised behind the scenes.",
  "Progress, not perfection, is how a practice improves.",
];

/** The line for a calendar day. The same day always gives the same line, and it changes at midnight local time. */
export function quoteForDay(d = new Date()): string {
  const day = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
