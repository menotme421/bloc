import Avatar from "boring-avatars";

export const PROFILE_AVATAR_COLORS = [
  "#ffabab",
  "#ffdaab",
  "#ddffab",
  "#abe4ff",
  "#987cfa",
];

export default function ProfileAvatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <Avatar
        size={size}
        name={name}
        variant="beam"
        colors={PROFILE_AVATAR_COLORS}
        className="size-full"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}