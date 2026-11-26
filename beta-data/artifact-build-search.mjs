export const ARTIFACT_SLOTS = ['Flower', 'Feather', 'Sand', 'Goblet', 'Head'];
const RESULT_SLOTS = ARTIFACT_SLOTS.map(slot => slot.toLowerCase());

export function buildArtifactIds(build) {
    return Object.fromEntries(RESULT_SLOTS.map((slot, index) => [slot, build[index].id]));
}

export function compareArtifactBuildIds(first, second) {
    for (const slot of RESULT_SLOTS) {
        const difference = first[slot] - second[slot];
        if (difference) return difference;
    }
    return 0;
}

// Keep the worst retained build at the root, using the same ordering as the final list.
export function createTopResults(limit, compare) {
    const heap = [];
    const swap = (a, b) => { [heap[a], heap[b]] = [heap[b], heap[a]]; };
    return {
        add(row) {
            if (heap.length < limit) {
                heap.push(row);
                let index = heap.length - 1;
                while (index > 0) {
                    const parent = (index - 1) >> 1;
                    if (compare(heap[index], heap[parent]) <= 0) break;
                    swap(index, parent);
                    index = parent;
                }
            } else if (compare(row, heap[0]) < 0) {
                heap[0] = row;
                let index = 0;
                while (2 * index + 1 < heap.length) {
                    let child = 2 * index + 1;
                    if (child + 1 < heap.length && compare(heap[child + 1], heap[child]) > 0) child++;
                    if (compare(heap[child], heap[index]) <= 0) break;
                    swap(child, index);
                    index = child;
                }
            }
        },
        get size() { return heap.length; },
        get worst() { return heap[0]; },
        finish: () => heap.sort(compare),
    };
}

// Traverse the Cartesian product in smallest-pool order. Set checks account for
// overlaps between the slots that could supply the pieces still missing.
export function createArtifactBuildTraversal(pools, required) {
    const order = pools.map((pool, index) => ({pool, index})).sort((a, b) => a.pool.length - b.pool.length);
    const slotCount = order.length;
    const suffix = Array(slotCount + 1).fill(1);
    for (let i = slotCount - 1; i >= 0; i--) suffix[i] = suffix[i + 1] * order[i].pool.length;

    const counts = new Map(required.map(([set]) => [set, 0]));
    const availableSets = order.map(({pool}) => new Set(pool.map(artifact => artifact.set_name)));
    const selected = Array(slotCount);
    const domains = [...pools];

    function reachable(depth) {
        const missing = required.map(([set, count]) => [set, Math.max(0, count - counts.get(set))]);
        function place(index, used) {
            if (index === missing.length) return true;
            const [set, count] = missing[index];
            function choose(start, left, mask) {
                if (!left) return place(index + 1, mask);
                for (let slot = start; slot <= slotCount - left; slot++) {
                    if (mask & (1 << slot) || !availableSets[slot].has(set)) continue;
                    if (choose(slot + 1, left - 1, mask | (1 << slot))) return true;
                }
                return false;
            }
            return choose(depth, count, used);
        }
        return place(0, 0);
    }

    return {
        candidateSpace: suffix[0],
        forEach({onBuild, onSkipSet, prune}) {
            function visit(depth) {
                if (required.length && !reachable(depth)) {
                    onSkipSet(suffix[depth]);
                    return;
                }
                if (prune && suffix[depth] && prune(domains, suffix[depth])) return;
                if (depth === slotCount) {
                    onBuild(selected);
                    return;
                }
                const {pool, index} = order[depth];
                for (const artifact of pool) {
                    selected[index] = artifact;
                    if (prune) domains[index] = [artifact];
                    const count = counts.get(artifact.set_name);
                    if (count !== undefined) counts.set(artifact.set_name, count + 1);
                    visit(depth + 1);
                    if (count !== undefined) counts.set(artifact.set_name, count);
                }
                if (prune) domains[index] = pool;
            }
            visit(0);
        },
    };
}
