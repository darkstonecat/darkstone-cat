export type TimelineEventType = "major" | "secondary";

export interface TimelineEvent {
  id: number;
  date: string;
  dateKey: string;
  nameKey: string;
  descriptionKey: string;
  type: TimelineEventType;
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 1,
    date: "2024-09-14",
    dateKey: "timeline_date_1",
    nameKey: "timeline_name_1",
    descriptionKey: "timeline_desc_1",
    type: "major",
  },
  {
    id: 2,
    date: "2024-11-30",
    dateKey: "timeline_date_2",
    nameKey: "timeline_name_2",
    descriptionKey: "timeline_desc_2",
    type: "major",
  },
  {
    id: 3,
    date: "2025-04-05",
    dateKey: "timeline_date_3",
    nameKey: "timeline_name_3",
    descriptionKey: "timeline_desc_3",
    type: "secondary",
  },
  {
    id: 4,
    date: "2025-05-24",
    dateKey: "timeline_date_4",
    nameKey: "timeline_name_4",
    descriptionKey: "timeline_desc_4",
    type: "secondary",
  },
  {
    id: 5,
    date: "2025-09-13",
    dateKey: "timeline_date_5",
    nameKey: "timeline_name_5",
    descriptionKey: "timeline_desc_5",
    type: "major",
  },
  {
    id: 6,
    date: "2025-10-04",
    dateKey: "timeline_date_6",
    nameKey: "timeline_name_6",
    descriptionKey: "timeline_desc_6",
    type: "secondary",
  },
  {
    id: 7,
    date: "2025-10-25",
    dateKey: "timeline_date_7",
    nameKey: "timeline_name_7",
    descriptionKey: "timeline_desc_7",
    type: "secondary",
  },
  {
    id: 8,
    date: "2025-11-29",
    dateKey: "timeline_date_8",
    nameKey: "timeline_name_8",
    descriptionKey: "timeline_desc_8",
    type: "major",
  },
  {
    id: 9,
    date: "2025-12-20",
    dateKey: "timeline_date_9",
    nameKey: "timeline_name_9",
    descriptionKey: "timeline_desc_9",
    type: "secondary",
  },
  {
    id: 10,
    date: "2026-02-28",
    dateKey: "timeline_date_10",
    nameKey: "timeline_name_10",
    descriptionKey: "timeline_desc_10",
    type: "major",
  },
];
