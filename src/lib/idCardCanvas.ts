import type { IdCardData } from "@/components/EmployeeIdCardModal";

function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = w / h;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

    if (imgRatio > targetRatio) {
        sw = img.naturalHeight * targetRatio;
        sx = (img.naturalWidth - sw) / 2;
    } else {
        sh = img.naturalWidth / targetRatio;
        // Focus slightly higher on faces
        sy = (img.naturalHeight - sh) * 0.18;
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
        [16, 8], [17, 10], [19, 9], [18, 12], [14, 18], [17, 19], [19, 18],
        [7, 15], [8, 18], [10, 17], [12, 19], [15, 12], [16, 14], [18, 16]
    ];
    for (const [px, py] of dots) {
        ctx.fillRect(x + px * cell, y + py * cell, cell * 1.4, cell * 1.4);
    }
}

function drawCropMarks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number) {
    ctx.save();
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = Math.max(1, 1.2 * s);
    const len = 16 * s;
    const offset = 6 * s;

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

/**
 * Draw Front Card scaled proportionally to any canvas dimensions.
 * Base reference width is 480px, height is 305px.
 */
export function drawFrontCard(
    ctx: CanvasRenderingContext2D,
    card: IdCardData,
    photoImg: HTMLImageElement | null,
    x: number,
    y: number,
    w: number,
    h: number
) {
    const s = w / 480; // Proportional scale factor
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Rounded Card Boundary (CR80 standard 3.18mm corner radius ≈ 26px * s)
    const cardRadius = 26 * s;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, cardRadius);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.strokeStyle = "#CBD5E1";
    ctx.stroke();
    ctx.clip();

    // ── TOP HEADER (Diagonal Split Black & Vibrant Orange) ──
    const headerH = 54 * s;
    // Right Orange section
    ctx.fillStyle = "#E65100";
    ctx.fillRect(x, y, w, headerH);

    // Deep Black Slanted Left Section
    const slantTop = 350 * s;
    const slantBottom = 332 * s;
    ctx.fillStyle = "#0A0A0A";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + slantTop, y);
    ctx.lineTo(x + slantBottom, y + headerH);
    ctx.lineTo(x, y + headerH);
    ctx.closePath();
    ctx.fill();

    // Logo Circle Emblem
    const emblemCx = x + 28 * s;
    const emblemCy = y + headerH / 2;
    const emblemR = 19 * s;

    ctx.beginPath();
    ctx.arc(emblemCx, emblemCy, emblemR, 0, Math.PI * 2);
    ctx.fillStyle = "#E65100";
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();

    // Dashed inner ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(emblemCx, emblemCy, emblemR - 4 * s, 0, Math.PI * 2);
    ctx.setLineDash([3 * s, 2 * s]);
    ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
    ctx.restore();

    // Logo Initials
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${Math.round(13 * s)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.orgInitials, emblemCx, emblemCy);

    // Titles
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `900 ${Math.round(10.5 * s)}px sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(card.orgName.toUpperCase().slice(0, 34), x + 54 * s, y + headerH * 0.44);

    ctx.font = `900 ${Math.round(13.5 * s)}px sans-serif`;
    ctx.fillStyle = "#FF7043";
    ctx.fillText(card.unitName.toUpperCase().slice(0, 34), x + 54 * s, y + headerH * 0.82);

    // Right Security Shield Icon
    const shieldX = x + w - 34 * s;
    const shieldY = y + headerH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(shieldX, shieldY - 12 * s);
    ctx.lineTo(shieldX + 14 * s, shieldY - 7 * s);
    ctx.quadraticCurveTo(shieldX + 14 * s, shieldY + 8 * s, shieldX, shieldY + 14 * s);
    ctx.quadraticCurveTo(shieldX - 14 * s, shieldY + 8 * s, shieldX - 14 * s, shieldY - 7 * s);
    ctx.closePath();
    ctx.fillStyle = "#FFA726";
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = Math.max(1, 1.8 * s);
    ctx.stroke();

    // White checkmark inside shield
    ctx.beginPath();
    ctx.moveTo(shieldX - 5 * s, shieldY);
    ctx.lineTo(shieldX - 1 * s, shieldY + 4 * s);
    ctx.lineTo(shieldX + 6 * s, shieldY - 4 * s);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = Math.max(1.5, 2.2 * s);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();

    // ── MIDDLE SECTION (Photo + Details) ──
    const photoX = x + 18 * s;
    const photoY = y + headerH + 14 * s;
    const photoW = 115 * s;
    const photoH = 142 * s;
    const photoR = 48 * s; // Oval frame

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
        ctx.font = `900 ${Math.round(32 * s)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(card.name.slice(0, 2).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2);
    }
    ctx.restore();

    // Photo Border
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoR);
    ctx.lineWidth = Math.max(1.5, 2.5 * s);
    ctx.strokeStyle = "#FED7AA";
    ctx.stroke();

    // Status Label below photo
    ctx.font = `900 ${Math.round(10 * s)}px sans-serif`;
    ctx.fillStyle = "#EA580C";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("STATUS: " + card.status.toUpperCase(), photoX + photoW / 2, photoY + photoH + 14 * s);

    // ── DETAILS COLUMN (Right) ──
    const colX = photoX + photoW + 20 * s;
    let curY = y + headerH + 22 * s;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    // Employee Name
    ctx.font = `900 ${Math.round(17 * s)}px sans-serif`;
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.name.toUpperCase().slice(0, 28), colX, curY);

    // Designation
    curY += 17 * s;
    ctx.font = `900 ${Math.round(11.5 * s)}px sans-serif`;
    ctx.fillStyle = "#EA580C";
    ctx.fillText(card.designation.toUpperCase().slice(0, 32), colX, curY);

    // Data Fields Table
    curY += 19 * s;
    const labelW = 44 * s;

    // S/O
    ctx.font = `900 ${Math.round(10 * s)}px sans-serif`;
    ctx.fillStyle = "#64748B";
    ctx.fillText("S/O:", colX, curY);
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.fatherName.toUpperCase().slice(0, 30), colX + labelW, curY);

    // DOB
    curY += 16 * s;
    ctx.fillStyle = "#64748B";
    ctx.fillText("DOB:", colX, curY);
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.dob, colX + labelW, curY);

    // ADDR
    curY += 16 * s;
    ctx.fillStyle = "#64748B";
    ctx.fillText("ADDR:", colX, curY);
    ctx.fillStyle = "#1E293B";
    const addr = card.address.toUpperCase();
    const maxChars = 34;
    if (addr.length <= maxChars) {
        ctx.fillText(addr, colX + labelW, curY);
    } else {
        ctx.fillText(addr.slice(0, maxChars), colX + labelW, curY);
        curY += 13 * s;
        ctx.fillText(addr.slice(maxChars, maxChars * 2), colX + labelW, curY);
    }

    // Phone & Blood Group
    curY += 21 * s;
    ctx.font = `900 ${Math.round(10.5 * s)}px sans-serif`;
    ctx.fillStyle = "#EA580C";
    ctx.fillText("📞", colX, curY);
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.phone, colX + 16 * s, curY);

    const bloodX = colX + 175 * s;
    ctx.fillStyle = "#E11D48";
    ctx.fillText("❤️", bloodX, curY);
    ctx.fillStyle = "#0F172A";
    ctx.fillText("B: " + card.bloodGroup, bloodX + 16 * s, curY);

    // ── BOTTOM FOOTER BAR ──
    const footerH = 46 * s;
    const footerY = y + h - footerH;
    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(x, footerY, w, footerH);

    ctx.beginPath();
    ctx.moveTo(x, footerY);
    ctx.lineTo(x + w, footerY);
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = Math.max(1, 1 * s);
    ctx.stroke();

    // EMPLOYEE ID
    ctx.font = `900 ${Math.round(8.5 * s)}px sans-serif`;
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("EMPLOYEE ID", x + 18 * s, footerY + 16 * s);
    ctx.font = `900 ${Math.round(12 * s)}px monospace`;
    ctx.fillStyle = "#0F172A";
    ctx.fillText(card.memberId, x + 18 * s, footerY + 33 * s);

    // BRANCH / LOCATION
    ctx.textAlign = "right";
    ctx.font = `900 ${Math.round(8.5 * s)}px sans-serif`;
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("BRANCH / LOCATION", x + w - 18 * s, footerY + 16 * s);
    ctx.font = `900 ${Math.round(12 * s)}px sans-serif`;
    ctx.fillStyle = "#EA580C";
    ctx.fillText(card.stateUnit.toUpperCase(), x + w - 18 * s, footerY + 33 * s);

    ctx.restore();
}

/**
 * Draw Back Card scaled proportionally to any canvas dimensions.
 * Base reference width is 480px, height is 305px.
 */
export function drawBackCard(
    ctx: CanvasRenderingContext2D,
    card: IdCardData,
    qrImg: HTMLImageElement | null,
    sigImg: HTMLImageElement | null,
    x: number,
    y: number,
    w: number,
    h: number
) {
    const s = w / 480; // Proportional scale factor
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Rounded Card Boundary
    const cardRadius = 26 * s;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, cardRadius);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.strokeStyle = "#CBD5E1";
    ctx.stroke();
    ctx.clip();

    // Center Watermark Logo
    const wmCx = x + w / 2;
    const wmCy = y + h / 2 - 10 * s;
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#E65100";
    ctx.fillStyle = "#E65100";
    ctx.lineWidth = Math.max(1.5, 3 * s);
    ctx.beginPath();
    ctx.arc(wmCx, wmCy, 75 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.arc(wmCx, wmCy, 60 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `900 ${Math.round(32 * s)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.orgInitials, wmCx, wmCy);
    ctx.restore();

    // Instructions Column
    const instrX = x + 24 * s;
    let curY = y + 28 * s;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `900 ${Math.round(13 * s)}px sans-serif`;
    ctx.fillStyle = "#0F172A";
    ctx.fillText("GENERAL INSTRUCTIONS", instrX, curY);

    // Underline
    ctx.beginPath();
    ctx.moveTo(instrX, curY + 6 * s);
    ctx.lineTo(instrX + 270 * s, curY + 6 * s);
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = Math.max(1, 1 * s);
    ctx.stroke();

    const instructions = [
        "THIS IDENTITY CARD IS STRICTLY NON-TRANSFERABLE.",
        "VALID ONLY WITH AUTHORIZED SIGNATURE.",
        "IF FOUND OR LOST, REPORT IMMEDIATELY TO HR DEPARTMENT.",
        `ONLINE VERIFICATION AVAILABLE AT ${card.website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").toLowerCase()}.`
    ];

    curY += 22 * s;
    ctx.font = `900 ${Math.round(9.5 * s)}px sans-serif`;
    for (const item of instructions) {
        ctx.fillStyle = "#EA580C";
        ctx.fillRect(instrX, curY - 7 * s, 5 * s, 5 * s);

        ctx.fillStyle = "#1E293B";
        ctx.fillText(item, instrX + 12 * s, curY);
        curY += 19 * s;
    }

    // QR Code Frame
    const qrBoxW = 105 * s;
    const qrBoxH = 105 * s;
    const qrX = x + w - qrBoxW - 24 * s;
    const qrY = y + 24 * s;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrBoxW, qrBoxH, 12 * s);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#FED7AA";
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.stroke();
    ctx.clip();

    if (qrImg) {
        ctx.drawImage(qrImg, qrX + 4 * s, qrY + 4 * s, qrBoxW - 8 * s, qrBoxH - 8 * s);
    } else {
        drawStylizedQr(ctx, qrX + 6 * s, qrY + 6 * s, qrBoxW - 12 * s);
    }
    ctx.restore();

    ctx.font = `900 ${Math.round(7.5 * s)}px sans-serif`;
    ctx.fillStyle = "#64748B";
    ctx.textAlign = "center";
    ctx.fillText("SCAN TO VERIFY", qrX + qrBoxW / 2, qrY + qrBoxH + 12 * s);
    ctx.fillText("AUTHENTICITY", qrX + qrBoxW / 2, qrY + qrBoxH + 21 * s);

    // Bottom Footer Bar
    const footerH = 58 * s;
    const footerY = y + h - footerH;

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(x, footerY, w, footerH);

    ctx.beginPath();
    ctx.moveTo(x, footerY);
    ctx.lineTo(x + w, footerY);
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = Math.max(1, 1 * s);
    ctx.stroke();

    // Shield Icon
    const sigShieldX = x + 24 * s;
    const sigShieldY = footerY + footerH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(sigShieldX, sigShieldY - 15 * s, 30 * s, 30 * s, 8 * s);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = Math.max(1, 1 * s);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sigShieldX + 15 * s, sigShieldY, 8 * s, 0, Math.PI * 2);
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.stroke();
    ctx.restore();

    // Signature Area
    const sigLineX = x + 65 * s;
    const sigLineW = 110 * s;
    const sigLineY = footerY + 34 * s;

    if (sigImg) {
        ctx.save();
        ctx.drawImage(sigImg, sigLineX, sigLineY - 24 * s, sigLineW, 22 * s);
        ctx.restore();
    }

    ctx.beginPath();
    ctx.moveTo(sigLineX, sigLineY);
    ctx.lineTo(sigLineX + sigLineW, sigLineY);
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = Math.max(1, 1 * s);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = `900 ${Math.round(7.5 * s)}px sans-serif`;
    ctx.fillStyle = "#64748B";
    ctx.fillText("AUTHORIZED SIGNATORY", sigLineX + sigLineW / 2, sigLineY + 10 * s);

    if (card.signatoryName) {
        ctx.font = `bold ${Math.round(6.5 * s)}px sans-serif`;
        ctx.fillStyle = "#64748B";
        const titleStr = card.signatoryTitle ? ` • ${card.signatoryTitle}` : "";
        ctx.fillText((card.signatoryName + titleStr).slice(0, 32), sigLineX + sigLineW / 2, sigLineY + 18 * s);
    }

    // Right Company Titles
    ctx.textAlign = "right";
    ctx.font = `900 ${Math.round(11 * s)}px sans-serif`;
    ctx.fillStyle = "#0F172A";
    ctx.fillText(`${card.orgName} • ${card.stateUnit}`, x + w - 24 * s, footerY + 18 * s);

    ctx.font = `900 ${Math.round(8.5 * s)}px sans-serif`;
    ctx.fillStyle = "#EA580C";
    ctx.fillText(card.tagline, x + w - 24 * s, footerY + 32 * s);

    ctx.font = `bold ${Math.round(8 * s)}px sans-serif`;
    ctx.fillStyle = "#64748B";
    ctx.fillText(card.website, x + w - 24 * s, footerY + 46 * s);

    ctx.restore();
}

/**
 * Generate Ultra High-Definition ID Card PDF (712 DPI CR80 Badges + 300 DPI A4 Print Sheet)
 */
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

    // Preload all assets in parallel at highest resolution
    const qrPayload = `COMPANY:${cardData.orgName}|EMP_ID:${cardData.memberId}|NAME:${cardData.name}|DESIG:${cardData.designation}|BRANCH:${cardData.stateUnit}|STATUS:${cardData.status}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&color=ea580c&bgcolor=ffffff&data=${encodeURIComponent(qrPayload)}`;

    const [photoImg, sigImg, qrImg] = await Promise.all([
        loadImage(photoUrl),
        loadImage(cardData.signatureUrl),
        loadImage(qrUrl).catch(() => null),
    ]);

    // ── 1. RENDER ULTRA HD FRONT CARD CANVAS (2400 x 1525 px @ 712 DPI) ──
    const cardCanvasW = 2400;
    const cardCanvasH = 1525;

    const frontCanvas = document.createElement("canvas");
    frontCanvas.width = cardCanvasW;
    frontCanvas.height = cardCanvasH;
    const frontCtx = frontCanvas.getContext("2d");
    if (!frontCtx) throw new Error("Could not initialize Front Canvas");
    drawFrontCard(frontCtx, cardData, photoImg, 0, 0, cardCanvasW, cardCanvasH);

    // ── 2. RENDER ULTRA HD BACK CARD CANVAS (2400 x 1525 px @ 712 DPI) ──
    const backCanvas = document.createElement("canvas");
    backCanvas.width = cardCanvasW;
    backCanvas.height = cardCanvasH;
    const backCtx = backCanvas.getContext("2d");
    if (!backCtx) throw new Error("Could not initialize Back Canvas");
    drawBackCard(backCtx, cardData, qrImg, sigImg, 0, 0, cardCanvasW, cardCanvasH);

    // ── 3. RENDER A4 PRINTABLE SHEET CANVAS (2480 x 3508 px @ 300 DPI) ──
    const a4Canvas = document.createElement("canvas");
    a4Canvas.width = 2480;
    a4Canvas.height = 3508;
    const a4Ctx = a4Canvas.getContext("2d");
    if (!a4Ctx) throw new Error("Could not initialize A4 Canvas");

    a4Ctx.fillStyle = "#FFFFFF";
    a4Ctx.fillRect(0, 0, a4Canvas.width, a4Canvas.height);

    // CR80 is 85.6mm x 54.0mm. At 300 DPI: 1011 x 638 px
    const sheetCardW = printScale === "cr80" ? 1011 : 1417;
    const sheetCardH = printScale === "cr80" ? 638 : 898;
    const sA4 = sheetCardW / 480;

    a4Ctx.textAlign = "center";
    a4Ctx.font = "900 22px sans-serif";
    a4Ctx.fillStyle = "#475569";
    a4Ctx.fillText(`${cardData.orgName.toUpperCase()} — OFFICIAL IDENTITY BADGE`, a4Canvas.width / 2, 110);

    if (printLayout === "foldable") {
        const frontX = Math.round((a4Canvas.width - sheetCardW) / 2);
        const frontY = 170;
        drawFrontCard(a4Ctx, cardData, photoImg, frontX, frontY, sheetCardW, sheetCardH);
        drawCropMarks(a4Ctx, frontX, frontY, sheetCardW, sheetCardH, sA4);

        // Center Fold Guide
        const guideY = frontY + sheetCardH + 80;
        a4Ctx.save();
        a4Ctx.setLineDash([12, 10]);
        a4Ctx.strokeStyle = "#CBD5E1";
        a4Ctx.lineWidth = 2.5;
        a4Ctx.beginPath();
        a4Ctx.moveTo(frontX - 60, guideY);
        a4Ctx.lineTo(frontX + sheetCardW + 60, guideY);
        a4Ctx.stroke();
        a4Ctx.restore();

        a4Ctx.font = "bold 16px monospace";
        a4Ctx.fillStyle = "#94A3B8";
        a4Ctx.textAlign = "center";
        a4Ctx.fillText("✂   FOLD HERE (CENTER LINE)   ✂", a4Canvas.width / 2, guideY - 14);

        const backX = frontX;
        const backY = guideY + 80;
        drawBackCard(a4Ctx, cardData, qrImg, sigImg, backX, backY, sheetCardW, sheetCardH);
        drawCropMarks(a4Ctx, backX, backY, sheetCardW, sheetCardH, sA4);

        a4Ctx.font = "bold 15px sans-serif";
        a4Ctx.fillStyle = "#94A3B8";
        a4Ctx.textAlign = "center";
        a4Ctx.fillText(
            printScale === "cr80"
                ? "ISO 7810 CR80 Standard (85.6 mm × 54.0 mm) • 100% True Scale • Foldable A4 Layout"
                : "Display Badge Specification (120 mm × 76 mm) • Foldable A4 Layout",
            a4Canvas.width / 2,
            backY + sheetCardH + 110
        );
    } else {
        const gap = 100;
        const totalW = sheetCardW * 2 + gap;
        const startX = Math.round((a4Canvas.width - totalW) / 2);
        const startY = Math.round((a4Canvas.height - sheetCardH) / 2);

        const frontX = startX;
        const frontY = startY;
        drawFrontCard(a4Ctx, cardData, photoImg, frontX, frontY, sheetCardW, sheetCardH);
        drawCropMarks(a4Ctx, frontX, frontY, sheetCardW, sheetCardH, sA4);

        const backX = frontX + sheetCardW + gap;
        const backY = startY;
        drawBackCard(a4Ctx, cardData, qrImg, sigImg, backX, backY, sheetCardW, sheetCardH);
        drawCropMarks(a4Ctx, backX, backY, sheetCardW, sheetCardH, sA4);

        a4Ctx.font = "bold 15px sans-serif";
        a4Ctx.fillStyle = "#94A3B8";
        a4Ctx.textAlign = "center";
        a4Ctx.fillText(
            printScale === "cr80"
                ? "ISO 7810 CR80 Standard (85.6 mm × 54.0 mm) • 100% True Scale • Side-by-Side Printing"
                : "Display Badge Specification (120 mm × 76 mm) • Side-by-Side Printing",
            a4Canvas.width / 2,
            startY + sheetCardH + 110
        );
    }

    // ── 4. COMPOSE MULTI-PAGE ULTRA-HD PDF VIA jsPDF ──
    // Page 1: Front Card (CR80 85.6 x 54.0 mm, 712 DPI, Zero Lossy Compression)
    const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [85.6, 54.0],
        compress: false,
    });

    const frontDataUrl = frontCanvas.toDataURL("image/png");
    pdf.addImage(frontDataUrl, "PNG", 0, 0, 85.6, 54.0, undefined, "NONE");

    // Page 2: Back Card (CR80 85.6 x 54.0 mm, 712 DPI)
    const backDataUrl = backCanvas.toDataURL("image/png");
    pdf.addPage([85.6, 54.0], "landscape");
    pdf.addImage(backDataUrl, "PNG", 0, 0, 85.6, 54.0, undefined, "NONE");

    // Page 3: Full A4 Print Sheet (210 x 297 mm, 300 DPI)
    const a4DataUrl = a4Canvas.toDataURL("image/png");
    pdf.addPage("a4", "portrait");
    pdf.addImage(a4DataUrl, "PNG", 0, 0, 210, 297, undefined, "NONE");

    pdf.save(`ID_Card_${cardData.memberId}_${cardData.name.replace(/\s+/g, "_")}.pdf`);
}
