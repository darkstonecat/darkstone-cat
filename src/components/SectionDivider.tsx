interface SectionDividerProps {
  topColor: string;
  bottomColor: string;
  variant?: "wave" | "curve" | "tilt";
  flip?: boolean;
}

const PATHS = {
  wave: "M0,80 C360,10 540,140 720,70 C900,0 1080,140 1440,60 L1440,160 L0,160 Z",
  curve: "M0,120 Q720,-10 1440,120 L1440,160 L0,160 Z",
  tilt: "M0,100 L1440,20 L1440,160 L0,160 Z",
};

export default function SectionDivider({
  topColor,
  bottomColor,
  variant = "wave",
  flip = false,
}: SectionDividerProps) {
  return (
    <div
      className="relative -mt-px w-full overflow-hidden"
      style={{ backgroundColor: topColor, lineHeight: 0 }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className={`block h-16 w-full md:h-24 lg:h-32 ${flip ? "-scale-x-100" : ""}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={PATHS[variant]} fill={bottomColor} />
      </svg>
    </div>
  );
}
