import type { IdCardData } from "@/components/EmployeeIdCardModal";

function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
            // Fallback for data URLs or servers without CORS headers
            const fallback = new Image();
            fallback.onload = () => resolve(fallback);
            fallback.onerror = () => resolve(null);
            fallback.src = src;
        };
        img.src = src;
    });
}

function drawAspectFillImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
) {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = w / h;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

    if (imgRatio > targetRatio) {
        sw = img.naturalHeight * targetRatio;
        sx = (img.naturalWidth - sw) / 2;
    } else {
        sh = img.naturalWidth / targetRatio;
        // Position slightly higher than dead-center to focus on head/face
        sy = (img.naturalHeight - sh) * 0.2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawStylizedQr(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.fillStyle = "#EA580C";
    const cell = size / 21;
    const drawFinder = (fx: number, fy: number) => {
        ctx.fillRect(x + fx * cell, y + fy * cell, 7 * cell, 7 * cell);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(x + (fx + 1) * cell, y + (fy + 1) * cell, 5 * cell, 5 * cell);
        ctx.fillStyle = "#EA580C";
        ctx.fillRect(x + (fx + 2) * cell, y + (fy + 2) * cell, 3 * cell, 3 * cell);
    };

    drawFinder(0, 0);
    drawFinder(14, 0);
    drawFinder(0, 14);

    for (let i = 8; i < 13; i += 2) {
        ctx.fillRect(x + i * cell, y + 6 * cell, cell, cell);
        ctx.fillRect(x + 6 * cell, y + i * cell, cell, cell);
    }

    ctx.fillRect(x + 14 * cell, y + 14 * cell, 3 * cell, 3 * cell);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x + 15 * cell, y + 15 * cell, cell, cell);
    ctx.fillStyle = "#EA580C";

    const dots = [
        [8, 2], [9, 3], [11, 4], [8, 8], [9, 10], [12, 9], [10, 12],
        [2, 8], [4, 9], [3, 11], [5, 12], [8, 14], [9, 17], [11, 16],
        [16, 8], [17, 10], [19, 9], [18, 12], [14, 18], [17, 19], [19, 18]
    ];
    for (const [px, py] of dots) {
        ctx.fillRect(x + px * cell, y + py * cell, cell * 1.5, cell * 1.5);
    }
}

function drawCropMarks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1;
    const len = 14;
    const offset = 5;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x - offset - len, y);
    ctx.lineTo(x - offset, y);
    ctx.moveTo(x, y - offset - len);
    ctx.lineTo(x, y - offset);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + w + offset, y);
    ctx.lineTo(x + w + offset + len, y);
    ctx.moveTo(x + w, y - offset - len);
    ctx.lineTo(x + w, y - offset);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x - offset - len, y + h);
    ctx.lineTo(x - offset, y + h);
    ctx.moveTo(x, y + h + offset);
    ctx.lineTo(x, y + h + offset + len);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + w + offset, y + h);
    ctx.lineTo(x + w + offset + len, y + h);
    ctx.moveTo(x + w, y + h + offset);
    ctx.lineTo(x + w, y + h + offset + len);
    ctx.stroke();

    ctx.restore();
}

function drawFrontCard(
    ctx: CanvasRenderingContext2D,
    card: IdCardData,
    photoImg: HTMLImageElement | null,
    x: number,
    y: number,
    w: number,
    h: number
) {
    ctx.save();
    // Rounded Card Boundary (CR80 standard corner radius)
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 26);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#CBD5E1";
    ctx.stroke();
    ctx.clip();

    // ── TOP HEADER (Diagonal Split Black & Vibrant Orange) ──
    const headerH = Math.round(h * 0.177); // ~75px
    // Orange Right
    ctx.fillStyle = "#E65100";
    ctx.fillRect(x, y, w, headerH);

    // Deep Black Slanted Left
    const slantTop = Math.round(w * 0.73);
    const slantBottom = slantTop - 22;
    ctx.fillStyle = "#0A0A0A";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + slantTop, y);
    ctx.lineTo(x + slantBottom, y + headerH);
    ctx.lineTo(x, y + headerH);
    ctx.closePath();
    ctx.fill();

    // Logo Circle Emblem
    const emblemCx = x + 38;
    const emblemCy = y + Math.round(headerH / 2);
    const emblemR = 24;

    ctx.beginPath();
    ctx.arc(emblemCx, emblemCy, emblemR, 0, Math.PI * 2);
    ctx.fillStyle = "#E65100";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(emblemCx, emblemCy, emblemR - 5, 0, Math.PI * 2);
    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.orgInitials, emblemCx, emblemCy);

    // Titles
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 13px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(card.orgName.toUpperCase().slice(0, 36), x + 72, y + Math.round(headerH * 0.44));

    ctx.font = "900 17px sans-serif";
    ctx.fillStyle = "#FF7043";
    ctx.fillText(card.unitName.toUpperCase().slice(0, 36), x + 72, y + Math.round(headerH * 0.82));

    // Right Security Shield Icon
    const shieldX = x + w - 44;
    const shieldY = y + Math.round(headerH / 2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(shieldX, shieldY - 16);
    ctx.lineTo(shieldX + 18, shieldY - 9);
    ctx.quadraticCurveTo(shieldX + 18, shieldY + 11, shieldX, shieldY + 18);
    ctx.quadraticCurveTo(shieldX - 18, shieldY + 11, shieldX - 18, shieldY - 9);
    ctx.closePath();
    ctx.fillStyle = "#FFA726";
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(shieldX - 7, shieldY);
    ctx.lineTo(shieldX - 1, shieldY + 5);
    ctx.lineTo(shieldX + 8, shieldY - 5);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();

    // ── MIDDLE SECTION (Photo + Details) ──
    const photoX = x + 24;
    const photoY = y + headerH + 20;
    const photoW = 160;
    const photoH = 198;
    const photoR = 64; // Oval frame

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoR);
    ctx.clip();
    if (photoImg) {
        drawAspectFillImage(ctx, photoImg, photoX, photoY, photoW, photoH);
    } else {
        const grad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
        grad.addColorStop(0, "#E2E8F0");
        grad.addColorStop(1, "#CBD5E1");
        ctx.fillStyle = grad;
        ctx.fillRect(photoX, photoY, photoW, photoH);

        ctx.fillStyle = "#475569";
        ctx.font = "900 42px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(card.name.slice(0, 2).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2);
    }
    ctx.restore();

    // Photo Border
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoR);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FED7AA";
    ctx.stroke();

    // Status Label below photo
    ctx.font = "900 13px sans-serif";
    ctx.fillStyle = "#EA580C";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("STATUS: " + card.status.toUpperCase(), photoX + photoW / 2, photoY + photoH + 18);

    // Details Column
    const colX = photoX + photoW + 28;
    let curY = y + headerH + 34;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    // Name
    ctx.font = "900 23px sans-serif";
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.name.toUpperCase().slice(0, 28), colX, curY);

    // Designation
    curY += 24;
    ctx.font = "900 15px sans-serif";
    ctx.fillStyle = "#EA580C";
    ctx.fillText(card.designation.toUpperCase().slice(0, 34), colX, curY);

    // Table Fields
    curY += 26;
    const labelW = 58;

    // S/O
    ctx.font = "900 13px sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("S/O:", colX, curY);
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.fatherName.toUpperCase().slice(0, 32), colX + labelW, curY);

    // DOB
    curY += 22;
    ctx.fillStyle = "#64748B";
    ctx.fillText("DOB:", colX, curY);
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.dob, colX + labelW, curY);

    // ADDR
    curY += 22;
    ctx.fillStyle = "#64748B";
    ctx.fillText("ADDR:", colX, curY);
    ctx.fillStyle = "#1E293B";
    const addr = card.address.toUpperCase();
    const maxChars = 34;
    if (addr.length <= maxChars) {
        ctx.fillText(addr, colX + labelW, curY);
    } else {
        ctx.fillText(addr.slice(0, maxChars), colX + labelW, curY);
        curY += 18;
        ctx.fillText(addr.slice(maxChars, maxChars * 2), colX + labelW, curY);
    }

    // Phone & Blood Group
    curY += 30;
    ctx.font = "900 14px sans-serif";
    ctx.fillStyle = "#EA580C";
    ctx.fillText("📞", colX, curY);
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.phone, colX + 22, curY);

    const bloodX = colX + 230;
    ctx.fillStyle = "#E11D48";
    ctx.fillText("❤️", bloodX, curY);
    ctx.fillStyle = "#0F172A";
    ctx.fillText("B: " + card.bloodGroup, bloodX + 22, curY);

    // ── BOTTOM FOOTER BAR ──
    const footerH = 60;
    const footerY = y + h - footerH;
    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(x, footerY, w, footerH);

    ctx.beginPath();
    ctx.moveTo(x, footerY);
    ctx.lineTo(x + w, footerY);
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.stroke();

    // EMPLOYEE ID
    ctx.font = "900 11px sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("EMPLOYEE ID", x + 24, footerY + 22);
    ctx.font = "900 16px monospace";
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.memberId, x + 24, footerY + 44);

    // BRANCH / LOCATION
    ctx.textAlign = "right";
    ctx.font = "900 11px sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("BRANCH / LOCATION", x + w - 24, footerY + 22);
    ctx.font = "900 16px sans-serif";
    ctx.fillStyle = "#EA580C";
    ctx.fillText(card.stateUnit.toUpperCase(), x + w - 24, footerY + 44);

    ctx.restore();
}

function drawBackCard(
    ctx: CanvasRenderingContext2D,
    card: IdCardData,
    qrImg: HTMLImageElement | null,
    sigImg: HTMLImageElement | null,
    x: number,
    y: number,
    w: number,
    h: number
) {
    ctx.save();
    // Rounded Card Boundary
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 26);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#CBD5E1";
    ctx.stroke();
    ctx.clip();

    // Watermark Logo
    const wmCx = x + Math.round(w / 2);
    const wmCy = y + Math.round(h / 2) - 15;
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#E65100";
    ctx.fillStyle = "#E65100";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wmCx, wmCy, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "900 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.orgInitials, wmCx, wmCy);
    ctx.restore();

    // Instructions
    const instrX = x + 30;
    let curY = y + 36;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 17px sans-serif";
    ctx.fillStyle = "#0F172A";
    ctx.fillText("GENERAL INSTRUCTIONS", instrX, curY);

    ctx.beginPath();
    ctx.moveTo(instrX, curY + 8);
    ctx.lineTo(instrX + 360, curY + 8);
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const instructions = [
        "THIS IDENTITY CARD IS STRICTLY NON-TRANSFERABLE.",
        "VALID ONLY WITH AUTHORIZED SIGNATURE.",
        "IF FOUND OR LOST, REPORT IMMEDIATELY TO HR DEPARTMENT.",
        `ONLINE VERIFICATION AVAILABLE AT ${card.website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").toLowerCase()}.`
    ];

    curY += 30;
    ctx.font = "900 12.5px sans-serif";
    for (const item of instructions) {
        ctx.fillStyle = "#EA580C";
        ctx.fillRect(instrX, curY - 9, 6, 6);

        ctx.fillStyle = "#1E293B";
        ctx.fillText(item, instrX + 16, curY);
        curY += 26;
    }

    // QR Code
    const qrBoxW = 140;
    const qrBoxH = 140;
    const qrX = x + w - qrBoxW - 30;
    const qrY = y + 30;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrBoxW, qrBoxH, 16);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#FED7AA";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.clip();

    if (qrImg) {
        ctx.drawImage(qrImg, qrX + 6, qrY + 6, qrBoxW - 12, qrBoxH - 12);
    } else {
        drawStylizedQr(ctx, qrX + 8, qrY + 8, qrBoxW - 16);
    }
    ctx.restore();

    ctx.font = "900 10px sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.textAlign = "center";
    ctx.fillText("SCAN TO VERIFY", qrX + qrBoxW / 2, qrY + qrBoxH + 16);
    ctx.fillText("AUTHENTICITY", qrX + qrBoxW / 2, qrY + qrBoxH + 28);

    // Bottom Footer Bar
    const footerH = 76;
    const footerY = y + h - footerH;

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(x, footerY, w, footerH);

    ctx.beginPath();
    ctx.moveTo(x, footerY);
    ctx.lineTo(x + w, footerY);
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shield Icon
    const sigShieldX = x + 30;
    const sigShieldY = footerY + Math.round(footerH / 2);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(sigShieldX, sigShieldY - 18, 36, 36, 10);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sigShieldX + 18, sigShieldY, 10, 0, Math.PI * 2);
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    // Signature Area
    const sigLineX = x + 80;
    const sigLineW = 150;
    const sigLineY = footerY + 44;

    if (sigImg) {
        ctx.save();
        ctx.drawImage(sigImg, sigLineX, sigLineY - 32, sigLineW, 30);
        ctx.restore();
    }

    ctx.beginPath();
    ctx.moveTo(sigLineX, sigLineY);
    ctx.lineTo(sigLineX + sigLineW, sigLineY);
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "900 9.5px sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("AUTHORIZED SIGNATORY", sigLineX + sigLineW / 2, sigLineY + 14);

    if (card.signatoryName) {
        ctx.font = "bold 8.5px sans-serif";
        ctx.fillStyle = "#64748B";
        const titleStr = card.signatoryTitle ? ` • ${card.signatoryTitle}` : "";
        ctx.fillText((card.signatoryName + titleStr).slice(0, 36), sigLineX + sigLineW / 2, sigLineY + 24);
    }

    // Right Company Branding
    ctx.textAlign = "right";
    ctx.font = "900 14px sans-serif";
    ctx.fillStyle = "#0F172A";
    ctx.fillText(`${card.orgName} • ${card.stateUnit}`, x + w - 30, footerY + 24);

    ctx.font = "900 11px sans-serif";
    ctx.fillStyle = "#EA580C";
    ctx.fillText(card.tagline, x + w - 30, footerY + 42);

    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText(card.website, x + w - 30, footerY + 60);

    ctx.restore();
}

export async function downloadIdCardPdf({
    cardData,
    photoUrl,
    printLayout,
    printScale,
}: {
    cardData: IdCardData;
    photoUrl: string | null;
    printLayout: "foldable" | "sideBySide";
    printScale: "cr80" | "large";
}): Promise<void> {
    const { jsPDF } = await import("jspdf");

    // Preload all assets in parallel
    const qrPayload = `COMPANY:${cardData.orgName}|EMP_ID:${cardData.memberId}|NAME:${cardData.name}|DESIG:${cardData.designation}|BRANCH:${cardData.stateUnit}|STATUS:${cardData.status}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=ea580c&bgcolor=ffffff&data=${encodeURIComponent(qrPayload)}`;

    const [photoImg, sigImg, qrImg] = await Promise.all([
        loadImage(photoUrl),
        loadImage(cardData.signatureUrl),
        loadImage(qrUrl).catch(() => null),
    ]);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not initialize 2D canvas context");

    // Standard A4 at 200 DPI: 1654 x 2338 px
    canvas.width = 1654;
    canvas.height = 2338;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // CR80 dimensions: 674 x 425 px (exact 85.6mm x 54.0mm scale)
    const cardW = printScale === "cr80" ? 674 : 850;
    const cardH = printScale === "cr80" ? 425 : 536;

    ctx.textAlign = "center";
    ctx.font = "900 14px sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText(`${cardData.orgName.toUpperCase()} — OFFICIAL IDENTITY CARD`, canvas.width / 2, 70);

    if (printLayout === "foldable") {
        const frontX = Math.round((canvas.width - cardW) / 2);
        const frontY = 110;
        drawFrontCard(ctx, cardData, photoImg, frontX, frontY, cardW, cardH);
        drawCropMarks(ctx, frontX, frontY, cardW, cardH);

        const guideY = frontY + cardH + 50;
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = "#CBD5E1";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(frontX - 40, guideY);
        ctx.lineTo(frontX + cardW + 40, guideY);
        ctx.stroke();
        ctx.restore();

        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#94A3B8";
        ctx.textAlign = "center";
        ctx.fillText("✂   FOLD HERE (CENTER LINE)   ✂", canvas.width / 2, guideY - 8);

        const backX = frontX;
        const backY = guideY + 50;
        drawBackCard(ctx, cardData, qrImg, sigImg, backX, backY, cardW, cardH);
        drawCropMarks(ctx, backX, backY, cardW, cardH);

        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#94A3B8";
        ctx.textAlign = "center";
        ctx.fillText(
            printScale === "cr80"
                ? "ISO 7810 CR80 Standard (85.6 mm × 54.0 mm) • 100% True Scale • Foldable A4 Layout"
                : "Display Badge Specification (120 mm × 76 mm) • Foldable A4 Layout",
            canvas.width / 2,
            backY + cardH + 70
        );
    } else {
        const gap = 60;
        const totalW = cardW * 2 + gap;
        const startX = Math.round((canvas.width - totalW) / 2);
        const startY = Math.round((canvas.height - cardH) / 2);

        const frontX = startX;
        const frontY = startY;
        drawFrontCard(ctx, cardData, photoImg, frontX, frontY, cardW, cardH);
        drawCropMarks(ctx, frontX, frontY, cardW, cardH);

        const backX = frontX + cardW + gap;
        const backY = startY;
        drawBackCard(ctx, cardData, qrImg, sigImg, backX, backY, cardW, cardH);
        drawCropMarks(ctx, backX, backY, cardW, cardH);

        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#94A3B8";
        ctx.textAlign = "center";
        ctx.fillText(
            printScale === "cr80"
                ? "ISO 7810 CR80 Standard (85.6 mm × 54.0 mm) • 100% True Scale • Side-by-Side Printing"
                : "Display Badge Specification (120 mm × 76 mm) • Side-by-Side Printing",
            canvas.width / 2,
            startY + cardH + 70
        );
    }

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");
    pdf.save(`ID_Card_${cardData.memberId}_${cardData.name.replace(/\s+/g, "_")}.pdf`);
}
