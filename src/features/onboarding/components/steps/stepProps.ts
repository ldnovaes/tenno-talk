export interface StepPosition {
  current: number;
  total: number;
  onBack?: (() => void) | undefined;
}

export interface StepProps {
  position: StepPosition;
  onNext: () => void;
}
