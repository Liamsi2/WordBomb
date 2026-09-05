with open("src/pages/GameLobby.tsx", "r") as f:
    c = f.read()

# Need to import getAvatarColor
if "getAvatarColor" not in c:
    c = c.replace("import { cn } from '../lib/utils';", "import { cn, getAvatarColor } from '../lib/utils';")

target = """<div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-600 flex items-center justify-center text-xs font-bold">
                    {p.display_name.charAt(0)}
                  </div>"""

repl = """<div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white", getAvatarColor(p.user_id))}>
                    {p.display_name.charAt(0)}
                  </div>"""

if target in c:
    c = c.replace(target, repl)
    print("Replaced lobby avatar")
else:
    print("Could not find lobby avatar target")

with open("src/pages/GameLobby.tsx", "w") as f:
    f.write(c)
