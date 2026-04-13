export function sanitizeFolderName(folderName: string): string {
    if (!folderName) {
        throw new Error('folderName 不能为空');
    }

    const safe = folderName.trim();

    if (!/^[a-zA-Z0-9_-]+$/.test(safe)) {
        throw new Error('folderName 只能包含字母、数字、下划线、中划线');
    }

    if (safe.includes('..')) {
        throw new Error('folderName 非法');
    }

    return safe;
}