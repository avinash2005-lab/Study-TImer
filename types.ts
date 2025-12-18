
export interface Task {
  id: string;
  text: string;
  done: boolean;
}

export interface Settings {
  studyMin: number;
  breakMin: number;
  goalHrs: number;
}

export enum TimerStatus {
  READY = 'Ready',
  STUDYING = 'Studying',
  BREAK = 'Break',
  LUNCH = 'Lunch Break'
}
