import { Request, Response, NextFunction } from "express";
import * as pdfService from "./pdf.service.js";

export async function downloadPDF(req: Request, res: Response, next: NextFunction) {
  try {
    const { pdf, invoiceNumber } = await pdfService.generateInvoicePDFForUser(
      req.user!.userId,
      req.params.id
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Invoice-${invoiceNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
}

export async function preview(req: Request, res: Response, next: NextFunction) {
  try {
    const html = await pdfService.generateInvoiceHTMLForUser(req.user!.userId, req.params.id);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    next(error);
  }
}
