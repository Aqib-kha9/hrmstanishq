const fs = require("fs");
let content = fs.readFileSync("src/app/(dashboard)/onboarding/page.tsx", "utf8");

content = content.replace(
    /location: of\.find\(\(o: any\) => o\.name === emp\.location\)\?\.id\?\.toString\(\) \|\| "",/g,
    `location: emp.office_id ? emp.office_id.toString() : (emp.location ? of.find((o) => o.name === emp.location)?.id?.toString() : "") || "",`
);
fs.writeFileSync("src/app/(dashboard)/onboarding/page.tsx", content);
console.log("Fixed location issue!");
