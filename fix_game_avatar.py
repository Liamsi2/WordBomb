with open("src/pages/Game.tsx", "r") as f:
    c = f.read()

# Need to import getAvatarColor
if "getAvatarColor" not in c:
    c = c.replace("import { cn } from '../lib/utils';", "import { cn, getAvatarColor } from '../lib/utils';")

target = """              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2",
                p.id === game.current_player_id ? "bg-red-500 border-red-400 text-white" : "bg-neutral-800 border-neutral-700"
              )}>"""

repl = """              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 text-white transition-all",
                getAvatarColor(p.user_id),
                p.id === game.current_player_id ? "border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "border-transparent opacity-50"
              )}>"""

if target in c:
    c = c.replace(target, repl)
    print("Replaced game avatar")
else:
    print("Could not find game avatar target")

with open("src/pages/Game.tsx", "w") as f:
    f.write(c)
