import { Helmet } from "react-helmet-async";

interface SEOProps {
    title?: string;
    description?: string;
    path?: string;
    image?: string;
    type?: "website" | "article";
}

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://deliverty.app";
const DEFAULT_TITLE = "Deliverty - Передача посылок через попутчиков";
const DEFAULT_DESCRIPTION = "Передача посылок и документов через людей, которые летят по своим делам. Найдите человека, который летит по пути, или предложите свою поездку.";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

export default function SEO({
    title,
    description = DEFAULT_DESCRIPTION,
    path = "",
    image = DEFAULT_IMAGE,
    type = "website"
}: SEOProps) {
    const fullTitle = title ? `${title} | ${DEFAULT_TITLE.split(" - ")[0]}` : DEFAULT_TITLE;
    const url = `${SITE_URL}${path}`;

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="title" content={fullTitle} />
            <meta name="description" content={description} />
            <link rel="canonical" href={url} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={url} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:locale" content="ru_RU" />
            <meta property="og:site_name" content="Deliverty" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={url} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {/* Additional Meta Tags */}
            <meta name="robots" content="index, follow" />
            <meta name="language" content="Russian" />
            <meta name="author" content="Deliverty" />
        </Helmet>
    );
}

