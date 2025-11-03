import QRcode from "../model/QrCodeSchema.js";
import ShortUrl from "../model/ShortUrl.js";
import User from "../model/User.js";
import { v4 as uuid } from "uuid"

export const createShortUrl = async (req, res) => {
    const userId = req.user.userId;
    const { destinationUrl, slugName, tags, protected: isProtected, password } = req.body;

    if (!destinationUrl || !slugName) {
        return res.status(400).json({
            message: "Enter all required details",
        });
    }

    try {

        const isSlugNameExist = await ShortUrl.findOne({ slugName });
        if (isSlugNameExist) {
            return res.status(409).json({
                message: "Slug name already exists",
            });
        }

        const protocol = req.protocol;
        const domainName = req.get("host");
        const shortUrl = `${protocol}://${domainName}/${slugName}`;


        let finalPassword = null;
        if (isProtected) {
            finalPassword = password && password.trim() !== "" ? password : uuid();
        }


        const createNewShortUrl = await ShortUrl.create({
            destinationUrl,
            shortUrl,
            slugName,
            userId,
            tags: Array.isArray(tags) ? tags : [],
            protected: !!isProtected,
            password: finalPassword,
        });

        return res.status(201).json({
            message: "Short URL created successfully",
            data: createNewShortUrl,
        });
    } catch (err) {
        console.error("Error creating short URL:", err);
        return res.status(500).json({
            message: err.message || "Internal server error",
        });
    }
};




export const updateShortUrl = async (req, res) => {
    const userId = req.user.userId;
    const { id } = req.params;
    const { destinationUrl, slugName, tags, protected: isProtected, password } = req.body;

    try {

        const existingUrl = await ShortUrl.findById(id);
        if (!existingUrl) {
            return res.status(404).json({ message: "Short URL not found" });
        }


        if (existingUrl.userId.toString() !== userId) {
            return res.status(403).json({ message: "Not authorized to update this link" });
        }


        if (slugName && slugName !== existingUrl.slugName) {
            const slugConflict = await ShortUrl.findOne({ slugName });
            if (slugConflict) {
                return res.status(409).json({ message: "Slug name already exists" });
            }
        }


        if (destinationUrl) existingUrl.destinationUrl = destinationUrl;


        if (slugName) {
            const protocol = req.protocol;
            const domainName = req.get("host");
            existingUrl.slugName = slugName;
            existingUrl.shortUrl = `${protocol}://${domainName}/${slugName}`;
        }


        if (tags) {
            const newTags = Array.isArray(tags) ? tags : [tags];
            existingUrl.tags = newTags;
        }

        if (typeof isProtected !== "undefined") {
            existingUrl.protected = isProtected;

            if (isProtected) {

                existingUrl.password = password && password.trim() !== "" ? password : uuid();
            } else {

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
            message: "please enter a slug name to redirect"
        })
    }

    try {
        const urlData = await ShortUrl.findOne({ slugName });
        if (!urlData) {
            return res.status(404).json({
                message: "Slug not found",
            });
        }
        if (urlData.protected) {
            return res.redirect(301, `http://localhost:5173/protected/${urlData.slugName}`);
        }
        return res.redirect(301, urlData.destinationUrl);
    } catch (error) {
        return res.status(500).json({
            message: error.message
        })
    }
}

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
    const userId  = req.user.userId;
    const { qrUrl, destinationUrl } = req.body;
    if (!qrUrl && !destinationUrl) {
        return res.status(400).json({
            message: "Enter valid data to save the qr code in the data base"
        })
    }
    try {
        const QrCode = await QRcode.create({ qrUrl, destinationUrl, userId:userId });
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
