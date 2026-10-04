import {vec3} from 'gl-matrix'
import { AnimationType } from '../manager/playerAnimationState.js'
import { parseLinkIds } from '../manager/nodeManager.js'

const DirectionSmoothFactor = 0.15; // lower = smoother turns
const MinWaypointDistance = 1.5;    // skip waypoints closer than this

/*
 * Walks one unit from node to linked node over navigation paths, pausing 1-4 seconds at each node, as
 * my_web_wow's WanderController.cs. The C# computes the next path synchronously; here it comes from the
 * mpq server, so the unit stays idle until the path has arrived (pathPending).
 */
class WanderController {
    constructor(unit, nodeManager, startNode, calculatePath,
                setUnitAnimation, moveSpeed = 7) {
        this.unit = unit;
        this.nodeManager = nodeManager;
        this.currentNode = startNode;
        this.calculatePath = calculatePath;
        this.setUnitAnimation = setUnitAnimation;
        this.moveSpeed = moveSpeed;
        this.isEnabled = true;

        this.currentPath = null;
        this.pathIndex = 0;
        this.pathPending = false;
        this.waitTimer = 0;
        this.waitDuration = 0;
        this.smoothedDirection = null;
        this.previousNodeId = null;
        this.wasMoving = false;

        // Place unit at start node
        unit.setPosition(vec3.fromValues(startNode.x, startNode.y, startNode.z));
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    /* Called every frame. deltaTime is in milliseconds. */
    update(deltaTime) {
        if (!this.isEnabled) return;

        var dt = deltaTime / 1000;

        // Waiting at node
        if (this.waitTimer > 0) {
            if (this.wasMoving) {
                this.setUnitAnimation(this.unit, AnimationType.Idle);
                this.wasMoving = false;
            }
            this.waitTimer -= dt;
            return;
        }

        // Waiting for the next path from the server
        if (this.pathPending) return;

        // Need a new path
        if (this.currentPath === null || this.pathIndex >= this.currentPath.length) {
            this.pickNextPath();
            return;
        }

        var currentPos = this.unit.getPosition();

        // Skip waypoints that are too close
        while (this.pathIndex < this.currentPath.length - 1) {
            if (vec3.distance(this.currentPath[this.pathIndex], currentPos) < MinWaypointDistance)
                this.pathIndex++;
            else
                break;
        }

        var target = this.currentPath[this.pathIndex];
        var dir = vec3.subtract(vec3.create(), target, currentPos);
        var dist = vec3.length(dir);
        var step = this.moveSpeed * dt;

        if (dist <= step || dist < 0.5) {
            this.unit.setPosition(vec3.clone(target));
            this.pathIndex++;

            if (this.pathIndex >= this.currentPath.length) {
                this.waitDuration = 1 + Math.random() * 3.0;
                this.waitTimer = this.waitDuration;
                this.currentPath = null;

                // Arrived -> idle
                this.setUnitAnimation(this.unit, AnimationType.Idle);
                this.wasMoving = false;
            }
        } else {
            var normalized = vec3.scale(vec3.create(), dir, 1 / dist);

            if (this.smoothedDirection === null)
                this.smoothedDirection = normalized;
            else
                vec3.lerp(this.smoothedDirection, this.smoothedDirection, normalized, DirectionSmoothFactor);

            var newPos = vec3.scaleAndAdd(vec3.create(), currentPos, normalized, step);
            this.unit.setPosition(newPos);

            var angle = Math.atan2(this.smoothedDirection[1], this.smoothedDirection[0]);
            this.unit.setRotation(angle);

            // Moving -> run animation
            if (!this.wasMoving) {
                this.setUnitAnimation(this.unit, AnimationType.Run);
                this.wasMoving = true;
            }
        }
    }

    pickNextPath() {
        var nextNode = this.pickLinkedNodeAvoidingPrevious();

        if (nextNode === null)
            nextNode = this.nodeManager.getRandomNode();
        if (nextNode === null) return;

        var startPos = vec3.clone(this.unit.getPosition());
        var endPos = vec3.fromValues(nextNode.x, nextNode.y, nextNode.z);
        var node = nextNode;

        this.pathPending = true;
        this.calculatePath(startPos, endPos).then((path) => {
            this.pathPending = false;
            this.previousNodeId = this.currentNode.id;

            if (path.length < 2) {
                this.unit.setPosition(endPos);
                this.currentNode = node;
                this.currentPath = null;
                this.pathIndex = 0;
                this.waitTimer = 2;
                this.smoothedDirection = null; // reset smoothing
                return;
            }

            this.currentNode = node;
            this.currentPath = path;
            this.pathIndex = 1;
            this.smoothedDirection = null; // reset smoothing for new path
        });
    }

    pickLinkedNodeAvoidingPrevious() {
        var node = this.nodeManager.getNode(this.currentNode.id);
        if (!node || node.links.trim() === '')
            return null;

        var allLinkedIds = parseLinkIds(node.links);
        if (allLinkedIds.length === 0) return null;

        // Filter out the node we just came from, unless it's the only option
        var candidates = allLinkedIds.filter((id) => id !== this.previousNodeId);
        if (candidates.length === 0)
            candidates = allLinkedIds; // only one link, allow going back

        var chosenId = candidates[Math.floor(Math.random() * candidates.length)];
        return this.nodeManager.getNode(chosenId) || null;
    }
}

export default WanderController;
