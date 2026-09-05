with open("src/lib/utils.ts", "r") as f:
    c = f.read()

target = """export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}"""

repl = """export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const colors = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 
  'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}"""

if target in c:
    c = c.replace(target, repl)
    print("Replaced utils")

with open("src/lib/utils.ts", "w") as f:
    f.write(c)
