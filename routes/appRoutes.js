import express from "express";
import { addDomain, createShortUrl, createToken, deleteDomain, deleteQrCode, deleteToken, deleteUrl, filterShortUrls, getAllTags, getMatchedUrls, getTokens, getUrlBySlugName, getUserData, getUserDomains, getUserQrCodes, saveQrCode, searchUrl, totalShortUrlByUser, updateShortUrl, UserCreatedShortLinksList } from "../controllers/appControllers.js";


const router = express.Router();

router.post("/create",createShortUrl);
router.post("/create/:userId",createShortUrl);
router.get("/short-urls",UserCreatedShortLinksList);
router.get("/get-user",getUserData);
router.get("/search",searchUrl);
router.get("/tags",getAllTags);
router.put("/short-url/:id",updateShortUrl);
router.post("/matched-urls",getMatchedUrls);
router.get("/short-url/:slugName",getUrlBySlugName);
router.delete("/delete/:slugName",deleteUrl);
router.post("/qrcode",saveQrCode);
router.get("/my-qrcodes",getUserQrCodes);
router.delete("/qrcodes/:id",deleteQrCode);
router.post("/add-domain",addDomain);
router.delete("/domain/:domainName",deleteDomain);
router.get("/domains", getUserDomains);
router.get("/filter/:sort",filterShortUrls);
router.get("/total-short-urls",totalShortUrlByUser);
router.post("/create-token",createToken);
router.delete("/delete-token",deleteToken);
router.get("/tokens",getTokens);
router.post("/auth/logout", (req, res) => {
  res.clearCookie("token").json({ message: "Logged out" });
})
export default router;
