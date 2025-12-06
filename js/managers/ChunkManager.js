import * as T from 'three';

export class ChunkManager {
    constructor(chunkSize) {
        this.chunkSize = chunkSize;
        // Key: "x_z" string, Value: { objects: [objectData], meshGroup: THREE.Group | null }
        this.chunks = new Map(); 
        this.activeChunkIds = new Set();
        this.lastPlayerChunkId = null;
    }

    /**
     * Calculates the chunk ID for a given world position.
     * @param {T.Vector3} worldPosition The position in world space.
     * @returns {string} The chunk ID string.
     */
    getChunkId(worldPosition) {
        const x = Math.floor(worldPosition.x / this.chunkSize);
        const z = Math.floor(worldPosition.z / this.chunkSize);
        return `${x}_${z}`;
    }

    /**
     * Adds pre-generated object data to the correct chunk.
     * @param {object} objectData The raw data for an object (position, scale, model, etc.).
     */
    addObject(objectData) {
        const chunkId = this.getChunkId(objectData.position);
        if (!this.chunks.has(chunkId)) {
            this.chunks.set(chunkId, { objects: [], meshGroup: null });
        }
        this.chunks.get(chunkId).objects.push(objectData);
    }

    /**
     * Based on the player's position, determines which chunks need to be loaded and unloaded.
     * @param {T.Vector3} playerWorldPosition The player's current position in world space.
     * @param {number} renderDistance The radius of chunks to keep active, in chunk units.
     * @returns {{chunksToLoad: string[], chunksToUnload: string[]}}
     */
    update(playerWorldPosition, renderDistance) {
        const playerChunkId = this.getChunkId(playerWorldPosition);

        // Only update if the player has crossed into a new chunk.
        if (playerChunkId === this.lastPlayerChunkId) {
            return { chunksToLoad: [], chunksToUnload: [] };
        }

        const playerChunkX = Math.floor(playerWorldPosition.x / this.chunkSize);
        const playerChunkZ = Math.floor(playerWorldPosition.z / this.chunkSize);

        const newActiveChunkIds = new Set();
        for (let x = playerChunkX - renderDistance; x <= playerChunkX + renderDistance; x++) {
            for (let z = playerChunkZ - renderDistance; z <= playerChunkZ + renderDistance; z++) {
                newActiveChunkIds.add(`${x}_${z}`);
            }
        }

        const chunksToLoad = [...newActiveChunkIds].filter(id => !this.activeChunkIds.has(id));
        const chunksToUnload = [...this.activeChunkIds].filter(id => !newActiveChunkIds.has(id));

        this.activeChunkIds = newActiveChunkIds;
        this.lastPlayerChunkId = playerChunkId;
        
        // console.log(`New Chunks: ${chunksToLoad.length}, Unload Chunks: ${chunksToUnload.length}`);

        return { chunksToLoad, chunksToUnload };
    }
    
    /**
     * Retrieves the raw object data for a given chunk.
     * @param {string} chunkId The ID of the chunk.
     * @returns {object[]} An array of object data.
     */
    getChunkData(chunkId) {
        return this.chunks.get(chunkId)?.objects || [];
    }

    /**
     * Stores the THREE.Group that contains all meshes for a chunk.
     * @param {string} chunkId The ID of the chunk.
     * @param {T.Group} group The group containing the chunk's meshes.
     */
    setChunkMeshGroup(chunkId, group) {
        if (this.chunks.has(chunkId)) {
            this.chunks.get(chunkId).meshGroup = group;
        }
    }

    /**
     * Retrieves the THREE.Group of meshes for a given chunk.
     * @param {string} chunkId The ID of the chunk.
     * @returns {T.Group | null}
     */
    getChunkMeshGroup(chunkId) {
        return this.chunks.get(chunkId)?.meshGroup || null;
    }
}
