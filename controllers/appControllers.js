import QRcode from "../model/QrCodeSchema.js";
import ShortUrl from "../model/ShortUrl.js";
import User from "../model/User.js";
import { v4 as uuid } from "uuid"
import { UAParser } from "ua-parser-js";
import dns from "dns";



export const createShortUrl = async (req, res) => {
    const userId = req.user.userId;
    let { destinationUrl, slugName, tags, protected: isProtected, password, isActive } = req.body;

    if (!destinationUrl) {
        return res.status(400).json({ message: "Destination URL is required" });
    }

    slugName = slugName?.trim().toLowerCase();
    if (!slugName || slugName === "") {
        slugName = uuid().slice(0, 6);
    }

    try {

        const isSlugNameExist = await ShortUrl.findOne({ slugName });
        if (isSlugNameExist) {
            return res.status(409).json({ message: "Slug name already exists" });
        }

        const protocol = req.protocol;
        const domainName = req.get("host");
        const shortUrl = `${protocol}://${domainName}/${slugName}`;


        let finalPassword = null;
        if (isProtected) {
            // Note: If you store the password as plain text, you should hash it here!
            finalPassword = password?.trim() || uuid().slice(0, 10);
        }

        const createNewShortUrl = await ShortUrl.create({
            destinationUrl,
            shortUrl,
            slugName,
            userId,
            tags: Array.isArray(tags) ? tags : [],
            protected: !!isProtected,
            password: finalPassword,
            isActive: isActive,
        });

        return res.status(201).json({
            message: "Short URL created successfully",
            data: createNewShortUrl,
        });

    } catch (err) {
        console.error("Error creating short URL:", err);

        if (err.code === 11000) {
            return res.status(409).json({
                message: "Slug name already exists (DB unique index)"
            });
        }

        return res.status(500).json({
            message: err.message || "Internal server error",
        });
    }
};


export const updateShortUrl = async (req, res) => {
    const userId = req.user.userId;
    const { id } = req.params;
    const { destinationUrl, slugName, tags, protected: isProtected, password, isActive } = req.body;
    
    try {

        const existingUrl = await ShortUrl.findById(id);
        if (!existingUrl) {
            return res.status(404).json({ message: "Short URL not found" });
        }


        if (existingUrl.userId.toString() !== userId) {
            return res.status(403).json({ message: "Not authorized to update this link" });
        }


        if (slugName && slugName !== existingUrl.slugName) {
            // Trim and normalize the slug for checking
            const normalizedSlug = slugName.trim().toLowerCase();
            const slugConflict = await ShortUrl.findOne({ slugName: normalizedSlug });
            if (slugConflict) {
                return res.status(409).json({ message: "Slug name already exists" });
            }
            existingUrl.slugName = normalizedSlug;

            // Recalculate shortUrl only if slugName changed
            const protocol = req.protocol;
            const domainName = req.get("host");
            existingUrl.shortUrl = `${protocol}://${domainName}/${normalizedSlug}`;
        }


        if (destinationUrl) existingUrl.destinationUrl = destinationUrl;

        if (typeof isActive !== "undefined") existingUrl.isActive = isActive;

        if (tags) {
            // Ensure tags is handled correctly (array or single string, depending on your API contract)
            const newTags = Array.isArray(tags) ? tags : [tags];
            existingUrl.tags = newTags;
        }

        if (typeof isProtected !== "undefined") {
            existingUrl.protected = isProtected;

            if (isProtected) {
                // Set password if protected, or generate a new one if input is empty
                existingUrl.password = password && password.trim() !== "" ? password : uuid().slice(0, 10);
            } else {
                // Clear password if no longer protected
                existingUrl.password = null;
            }
        }

        await existingUrl.save();

        return res.status(200).json({
            message: "Short URL updated successfully",
            data: existingUrl,
        });
    } catch (error) {
        console.error("Error updating short URL:", error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};


export const redirectUrl = async (req, res) => {
    const { slugName } = req.params;

    if (!slugName) {
        return res.status(400).json({
            message: "Please enter a slug name to redirect",
        });
    }
   
    let urlData;
    try {
        // 1. Find the URL data first
        urlData = await ShortUrl.findOne({ slugName });
        if (!urlData) {
            return res.status(404).json({
                message: "Slug not found",
            });
        }
    } catch (error) {
        console.error("Error finding short URL:", error);
        return res.status(500).json({
            message: "Internal server error during lookup",
        });
    }
    if(!urlData.isActive){
        return res.redirect(302,`${process.env.MODE=="dev"?"http://localhost:5173":process.env.FRONTEND_END_URL}/in-active`)
    }
    // 2. Handle protected URL redirect immediately
    if (urlData.protected) {
        // Keeping 301 here, as the protected link is a 'permanent' requirement
        return res.redirect(302, `${process.env.MODE=="dev"?"http://localhost:5173":process.env.FRONTEND_END_URL}/protected/${urlData.slugName}`);
    }

    // 3. Immediately send the final destination redirect response
    //    *** FIX: Using 302 (Temporary Redirect) to ensure the browser hits the server every time ***
    res.redirect(302, urlData.destinationUrl);

    // 4. Perform analytics gathering ASYNCHRONOUSLY (Fire-and-Forget)
    //    This code runs in the background AFTER the user has been redirected.
    try {
        let ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "";
        let country = "Unknown";
        let city = "Unknown";

        // --- Geo-location lookup ---
        try {
            const geoRes = await fetch(`https://ipwho.is/${ip}`);
            const geoData = await geoRes.json();
            if (geoData.success) {
                country = geoData.country || "Unknown";
                city = geoData.city || "Unknown";
            }
        } catch (error) {
            console.error(`[Analytics Error: ${slugName}] Error fetching geo data:`, error.message);
        }

        // --- User Agent Parsing ---
        const parser = new UAParser(req.headers["user-agent"]);
        const browserName = parser.getBrowser().name || "Unknown";
        const deviceType = parser.getDevice().type || "Unknown";
        const osName = parser.getOS().name || "Unknown";

        // --- Build the MongoDB Update Object ---
        const updateData = {
            $inc: {
                clicks: 1,
                [`stats.${country}.count`]: 1,
                [`stats.${country}.cities.${city}`]: 1,
                [`deviceStats.${deviceType}`]: 1,
                [`browserStats.${browserName}`]: 1,
                [`osStats.${osName}`]: 1,
            },
            $set: {
                lastClickedAt: new Date().toISOString(),
            },
        };

        // --- Execute the Database Update (in the background) ---
        await ShortUrl.updateOne({ slugName }, updateData);

    } catch (error) {
        // This handles any failures in the background analytics process (e.g., Mongoose error)
        console.error(`[Analytics Fatal Error: ${slugName}] Failed to update stats:`, error);
    }
};
export const searchUrl = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log("search url triggered");
        const { tag, date } = req.query;
        console.log(date)
        console.log(tag)
        if ((!tag || tag.trim() === "") && (!date || date.trim() === "")) {
            return res.status(400).json({
                message: "Please provide at least a tag or a date to search",
            });
        }

        const filter = { userId: userId };

        if (tag && tag.trim() !== "") {
            filter.tags = { $regex: tag, $options: "i" };
        }

        if (date && date.trim() !== "") {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
        }


        const matchedUrls = await ShortUrl.find(filter).sort({ createdAt: -1 });

        if (matchedUrls.length === 0) {
            return res.status(404).json({ message: "No URLs found" });
        }
        console.log(matchedUrls)

        return res.status(200).json({
            count: matchedUrls.length,
            results: matchedUrls,
        });
    } catch (error) {
        console.error("Error in searchUrl:", error.message);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
        });
    }
};


export const UserCreatedShortLinksList = async (req, res) => {
    const userId = req.user.userId;
    console.log(userId)
    try {
        const data = await ShortUrl.find({ userId: userId });
        console.log(data)
        if (data == 0) {
            return res.status(404).json({
                message: "No short links found"
            })
        }

        return res.status(200).json(data);
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Internal server error"
        })
    }
}

export const getUserData = async (req, res) => {
    if (!req.user.userId) {
        return res.status(403).json({
            message: "Token not found"
        })
    }
    const userId = req.user.userId;
    try {
        const userData = await User.findOne({ _id: userId });
        if (!userData) {
            return res.status(409).json({
                message: "User not found"
            })
        }
        return res.status(200).json({
            userData: userData
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message
        })
    }
}


export const deleteUrl = async (req, res) => {
    const userId = req.user.userId;
    const { slugName } = req.params;
    if (!slugName) {
        return res.status(400).json({
            message: "Please a enter a slug name to delete"
        });
    }
    try {
        const data = await ShortUrl.deleteOne({ userId: userId, slugName });

        if (!data) {
            return res.status(404).json({
                message: "url not found"
            })
        }
        return res.status(200).json({
            message: "url deleted successfully",
            deletedUrl: data
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message
        })
    }
}

export const getUrlBySlugName = async (req, res) => {
    const { slugName } = req.params;
    if (!slugName) {
        return res.status(400).json({
            message: "please pass the params (slugname) to retrive the data of the short url"
        })
    }
    try {
        const data = await ShortUrl.findOne({ slugName });
        if (!data) {
            return res.status(404).json({
                message: "short url data not found"
            })
        }
        return res.status(200).json({
            result: data,
        })
    } catch (error) {
        return res.satuts(500).json({
            message: error.message
        })
    }
}


export const getAllTags = async (req, res) => {
    const userId = req.user.userId;
    if (!userId) {
        return res.status(403).json({
            message: "Token not found"
        })
    }
    try {
        const tags = await ShortUrl.distinct("tags", { userId: userId });
        return res.status(200).json({
            count: tags.length,
            tags
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: error.message
        })
    }
}

export const getMatchedUrls = async (req, res) => {
    const userId = req.user.userId;
    const { tagsList } = req.body;

    if (!userId) {
        return res.status(403).json({ message: "Token not found" });
    }

    if (!tagsList) {
        return res.status(400).json({
            message: "Please send tag list to find matching URLs",
        });
    }

    try {
        let matchedTags;

        if (tagsList.length === 0) {

            matchedTags = await ShortUrl.find({ userId: userId });


        } else {

            matchedTags = await ShortUrl.find({
                userId,
                tags: { $all: tagsList },
            });
        }

        return res.status(200).json({
            count: matchedTags.length,
            urls: matchedTags,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
};



export const redirectProtectPages = async (req, res) => {
    const { password, slugName } = req.body;

    if (!slugName || !password) {
        return res.status(400).json({
            message: "Please provide both slug name and password.",
        });
    }

    try {
        const urlData = await ShortUrl.findOne({ slugName });
        if (!urlData) {
            return res.status(404).json({
                message: "Slug not found.",
            });
        }


        if (urlData.password !== password) {
            return res.status(403).json({
                message: "Incorrect password.",
            });
        }

        return res.status(200).json({
            redirectUrl: urlData.destinationUrl,
            message: "Authentication successful. Redirecting...",
        });

    } catch (error) {
        return res.status(500).json({
            message: "Server error. Please try again later.",
            error: error.message,
        });
    }
}


export const saveQrCode = async (req, res) => {
    const userId = req.user.userId;
    const { qrUrl, destinationUrl } = req.body;
    if (!qrUrl && !destinationUrl) {
        return res.status(400).json({
            message: "Enter valid data to save the qr code in the data base"
        })
    }
    try {
        const QrCode = await QRcode.create({ qrUrl, destinationUrl, userId: userId });
        if (QrCode) {
            return res.status(200).json({
                message: "successfully saved to data base",
                qrCodeData: QrCode
            })
        }
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: error.message
        })
    }
}
export const getUserQrCodes = async (req, res) => {
    const userId = req.user.userId;

    try {
        const qrCodes = await QRcode.find({ userId });

        if (qrCodes.length === 0) {
            return res.status(404).json({
                message: "No QR codes found for this user"
            });
        }

        return res.status(200).json({
            message: "QR codes retrieved successfully",
            count: qrCodes.length,
            data: qrCodes
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Failed to retrieve QR codes",
            error: error.message
        });
    }
};
export const deleteQrCode = async (req, res) => {
    const userId = req.user.userId;
    const { id } = req.params;

    try {
        const qrCode = await QRcode.findOneAndDelete({ _id: id, userId });

        if (!qrCode) {
            return res.status(404).json({ message: "QR code not found or access denied" });
        }

        return res.status(200).json({ message: "QR code deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};


export const addDomain = async (req, res) => {
  const userId = req.user.userId;
  const { domainName } = req.body;

  if (!domainName) {
    return res.status(400).json({ message: "Please provide a domain name." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Ensure customDomain is an array
    if (!Array.isArray(user.customDomain)) {
      user.customDomain = [];
    }

    // Prevent duplicates
    if (user.customDomain.find((d) => d.name === domainName)) {
      return res.status(400).json({ message: "Domain already exists." });
    }

    // ✅ Step 1: Try resolving the domain’s CNAME record
    let cnameRecords = [];
    try {
      cnameRecords = await dns.resolveCname(domainName);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message:
          "Unable to resolve CNAME record. Please check your DNS settings and try again.",
        details: err.message,
      });
    }

    // ✅ Step 2: Verify that it points to your Render domain
    const expectedTarget = "trim-url-gpxt.onrender.com";
    const isValid = cnameRecords.some((r) => r === expectedTarget);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: `CNAME record must point to '${expectedTarget}'.`,
        foundRecords: cnameRecords,
      });
    }

    // ✅ Step 3: Save verified domain
    user.customDomain.push({
      name: domainName,
      verified: true,
      cnameTarget: expectedTarget,
      addedAt: new Date(),
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: "Domain verified and added successfully!",
      domains: user.customDomain,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserDomains = async (req, res) => {
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ domains: user.customDomain || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


export const filterShortUrls = async (req, res) => {
  const { sort } = req.params;
  const userId = req.user.userId;

  if (!sort) {
    return res.status(400).json({
      message: "Please specify a sort filter (e.g., active, inactive, protected, notprotected)"
    });
  }

  let filter = { userId };

  switch (sort) {
    case "active":
      filter.isActive = true;
      break;

    case "inactive":
      filter.isActive = false;
      break;

    case "protected":
      filter.protected = true;
      break;

    case "notprotected":
      filter.protected = false;
      break;

    default:
      return res.status(400).json({
        message: "Invalid sort value. Use one of: active, inactive, protected, notprotected"
      });
  }

  try {
    const data = await ShortUrl.find(filter);

    if (data.length === 0) {
      return res.status(404).json({
        message: `No ${sort} URLs found`
      });
    }

    return res.status(200).json({
      results: data
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

