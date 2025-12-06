import * as T from 'three';

export class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.grid = new Map();
        this.halfWidth = width / 2;
        this.halfHeight = height / 2;
    }

    _getKey(x, z) {
        const gridX = Math.floor((x + this.halfWidth) / this.cellSize);
        const gridZ = Math.floor((z + this.halfHeight) / this.cellSize);
        return `${gridX},${gridZ}`;
    }

    add(object) {
        // For rocks with multiple hitboxes, create a single bounding box that contains all of them for grid placement.
        const boundingBox = object.boxes ? object.boxes[0].clone() : object.box.clone();
        if (object.boxes) {
            for(let i = 1; i < object.boxes.length; i++) {
                boundingBox.union(object.boxes[i]);
            }
        }
        
        const minX = boundingBox.min.x;
        const minZ = boundingBox.min.z;
        const maxX = boundingBox.max.x;
        const maxZ = boundingBox.max.z;

        const startX = Math.floor((minX + this.halfWidth) / this.cellSize);
        const endX = Math.floor((maxX + this.halfWidth) / this.cellSize);
        const startZ = Math.floor((minZ + this.halfHeight) / this.cellSize);
        const endZ = Math.floor((maxZ + this.halfHeight) / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let z = startZ; z <= endZ; z++) {
                const key = `${x},${z}`;
                if (!this.grid.has(key)) {
                    this.grid.set(key, []);
                }
                this.grid.get(key).push(object);
            }
        }
    }

    getNearby(position, radius) {
        const nearbyObjects = new Set();
        const centerX = position.x;
        const centerZ = position.z;

        const minX = centerX - radius;
        const minZ = centerZ - radius;
        const maxX = centerX + radius;
        const maxZ = centerZ + radius;

        const startX = Math.floor((minX + this.halfWidth) / this.cellSize);
        const endX = Math.floor((maxX + this.halfWidth) / this.cellSize);
        const startZ = Math.floor((minZ + this.halfHeight) / this.cellSize);
        const endZ = Math.floor((maxZ + this.halfHeight) / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let z = startZ; z <= endZ; z++) {
                const key = `${x},${z}`;
                if (this.grid.has(key)) {
                    const cellObjects = this.grid.get(key);
                    for (const obj of cellObjects) {
                        nearbyObjects.add(obj);
                    }
                }
            }
        }
        return Array.from(nearbyObjects);
    }

    remove(object) {
        const boundingBox = object.boxes ? object.boxes[0].clone() : object.box.clone();
        if (object.boxes) {
            for(let i = 1; i < object.boxes.length; i++) {
                boundingBox.union(object.boxes[i]);
            }
        }

        const minX = boundingBox.min.x;
        const minZ = boundingBox.min.z;
        const maxX = boundingBox.max.x;
        const maxZ = boundingBox.max.z;

        const startX = Math.floor((minX + this.halfWidth) / this.cellSize);
        const endX = Math.floor((maxX + this.halfWidth) / this.cellSize);
        const startZ = Math.floor((minZ + this.halfHeight) / this.cellSize);
        const endZ = Math.floor((maxZ + this.halfHeight) / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let z = startZ; z <= endZ; z++) {
                const key = `${x},${z}`;
                if (this.grid.has(key)) {
                    const cell = this.grid.get(key);
                    const index = cell.indexOf(object);
                    if (index > -1) {
                        cell.splice(index, 1);
                    }
                }
            }
        }
    }
}
