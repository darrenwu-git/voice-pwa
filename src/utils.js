export const Utils = {
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString();
    },
    maskKey(key) {
        if (!key) return '無';
        if (key.length < 8) return '***';
        return `${key.substring(0, 4)}...${key.substring(key.length - 3)}`;
    }
};
