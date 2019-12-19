// Copyright 2019 The TensorNetwork Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

Vue.component(
    'toolbar',
    {
        mixins: [mixinGeometry],
        props: {
            state: Object
        },
        data: function() {
            return {
                copyNodeName: '',
            }
        },
        methods: {
            stopPropagation: function(event) {
                event.stopPropagation();
            },
            deselectNode: function() {
                this.state.selectedNodes = [];
            },
            copyNode: function(event) {
                event.preventDefault();
                let workspace = document.getElementById('workspace').getBoundingClientRect();

                let node = JSON.parse(JSON.stringify(this.node));
                node.name = this.copyNodeName;
                node.position = {x: workspace.width / 2, y: workspace.height / 2};
                if (this.state.snapToGrid) {
                    node.position.x = Math.round(node.position.x / this.gridSpacing) * this.gridSpacing;
                    node.position.y = Math.round(node.position.y / this.gridSpacing) * this.gridSpacing;
                }

                this.state.nodes.push(node);
                this.state.selectedNodes = [node];
                this.copyNodeName = '';
            },
        },
        computed: {
            node: function() {
                return this.state.selectedNodes[0];
            },
            copyNodeDisabled: function() {
                return this.nameTaken || this.copyNodeName == null || this.copyNodeName === '';
            },
            nameTaken: function() {
                for (let i = 0; i < this.state.nodes.length; i++) {
                    if (this.copyNodeName === this.state.nodes[i].name) {
                        return true;
                    }
                }
                return false;
            }
        },
        template: `
            <div class="toolbar">
                <div v-if="state.selectedNodes.length < 2">
                    <tensor-editor :state="state" />
                    <section v-if="state.selectedNodes.length === 0">
                        <h3>Selecting nodes</h3>
                        <p>Click a node to select it for editing.</p>
                        <p>Drag-select or shift-click multiple nodes to drag as a group and adjust alignment and
                        spacing.</p>
                    </section>
                    <section v-else>
                        <div class="button-holder">
                            <button @click="deselectNode">Create new node</button>
                        </div>
                        <h4>Copy Node</h4>
                        <form @submit="copyNode">
                            <input type="text" v-model="copyNodeName" @keypress="stopPropagation" @keydown="stopPropagation"
                                placeholder="name of copy" />
                            <input type="submit" value="Copy" :disabled="copyNodeDisabled" />
                        </form>
                    </section>
                    <div v-if="state.selectedNodes.length === 1">
                        <toolbar-edge-section :state="state" />
                        <toolbar-axis-section :state="state" />
                    </div>
                </div>
                <div v-else>
                    <toolbar-multinode-section :state="state" />
                </div>
            </div>
        `
    }
);

Vue.component(
    'tensor-editor',
    {
        mixins: [mixinGeometry, mixinDelete],
        props: {
            state: Object
        },
        data: function() {
            return {
                size1: 1,
                size2: 1,
                hue: 0,
                rotation: 0,
                node: {},
                width: 250,
                height: 250,
                dragSelector: {
                    dragging: false,
                    startX: null,
                    startY: null,
                    endX: null,
                    endY: null
                },
            };
        },
        created: function() {
            this.reset();
        },
        watch: {
            'state.selectedNodes': function() {
                if (this.state.selectedNodes.length !== 1) {
                    this.reset();
                }
                else {
                    this.node = JSON.parse(JSON.stringify(this.state.selectedNodes[0]));
                    this.node.position = JSON.parse(JSON.stringify(this.nodeInitial.position));
                    this.size1 = this.node.size[0];
                    this.size2 = this.node.size[1];
                    this.hue = this.node.hue;
                    this.rotation = this.node.rotation;
                }
            },
            size1: function() {
                this.resize();
            },
            size2: function() {
                this.resize();
            },
            hue: function() {
                this.node.hue = parseFloat(this.hue);
            },
            rotation: function() {
                this.node.rotation = parseFloat(this.rotation);
                this.editNode();
            }
        },
        methods: {
            stopPropagation: function(event) {
                event.stopPropagation();
            },
            reset: function() {
                this.node = JSON.parse(JSON.stringify(this.nodeInitial));
            },
            resize: function() {
                this.node.size = [parseFloat(this.size1), parseFloat(this.size2)];
                let allAxes = this.axes(parseFloat(this.size1), parseFloat(this.size2));
                this.node.axes.splice(allAxes.length);
                this.node.axes.forEach(function(axis, index) {
                    axis.angle = allAxes[index].angle;
                    axis.position = allAxes[index].position;
                });
            },
            rotate: function(angle) {
                this.rotation += angle;
            },
            updateNode: function(event) {
                event.preventDefault();
                if (this.createMode) {
                    this.createNode();
                }
                else {
                    this.editNode();
                }
            },
            editNode: function(event) {
                if (this.createMode) {
                    return;
                }
                let oldNode = this.state.selectedNodes[0];
                let newNode = JSON.parse(JSON.stringify(this.node));
                newNode.position = oldNode.position;
                this.state.selectedNodes = [newNode];
                this.pushNode(newNode, oldNode.name);
            },
            createNode: function() {
                let workspace = document.getElementById('workspace').getBoundingClientRect();

                let node = JSON.parse(JSON.stringify(this.node));
                node.position = {x: workspace.width / 2, y: workspace.height / 2};
                if (this.state.snapToGrid) {
                    node.position.x = Math.round(this.node.position.x / this.gridSpacing) * this.gridSpacing;
                    node.position.y = Math.round(this.node.position.y / this.gridSpacing) * this.gridSpacing;
                }
                this.pushNode(node);
            },
            deleteNode: function(event) {
                event.preventDefault();
                this.deleteSelectedNodes();
            },
            pushNode: function(node, originalName) {
                // Eliminate edges that no longer connect to axes
                this.state.edges = this.state.edges.filter(function(edge) {
                    if (edge[0][0] === node.name || edge[0][0] === originalName) {
                        return edge[0][1] < node.axes.length;
                    }
                    if (edge[1][0] === node.name || edge[1][0] === originalName) {
                        return edge[1][1] < node.axes.length
                    }
                    return true;
                });
                // Rename edges if there is a name change
                if (originalName) {
                    this.state.edges.forEach(function(edge) {
                        if (edge[0][0] === originalName) {
                            edge[0].splice(0, 1, node.name);
                        }
                        if (edge[1][0] === originalName) {
                            edge[1].splice(0, 1, node.name);
                        }
                    });
                }
                // Actually insert the node object in state.nodes
                for (let i = 0; i < this.state.nodes.length; i++) {
                    if (this.state.nodes[i].name === originalName
                        || this.state.nodes[i].name === node.name) {
                        this.state.nodes.splice(i, 1, node);
                        return;
                    }
                }
                this.state.nodes.push(this.node);
            },
            onShadowAxisMouseDown: function(node, axis) {
                let candidateAxis = this.nodeShadow.axes[axis];
                for (let j = 0; j < this.node.axes.length; j++) {
                    let existingAxis = this.node.axes[j];
                    if (candidateAxis.angle === existingAxis.angle
                        && candidateAxis.position[0] === existingAxis.position[0]
                        && candidateAxis.position[1] === existingAxis.position[1]) {
                        return;
                    }
                }
                this.node.axes.push(JSON.parse(JSON.stringify(candidateAxis)));
                this.editNode();
            },
            onNodeAxisMouseDown: function(node, axis) {
                this.node.axes.splice(axis, 1);
                this.editNode();
            },
            axes: function(size1, size2) {
                let makeAxis = function(direction, position) {
                    return {name: null, angle: direction * Math.PI / 4, position: position};
                };
                let output = [];

                let x = function(n) {
                    let x_end = Math.min((size1 - 1) / 2, 1);
                    return size1 !== 1 ? (-x_end * (size1 - 1 - n) + x_end * n) / (size1 - 1) : 0; // Avoid div by 0
                };
                let y = function(m) {
                    let y_end = Math.min((size2 - 1) / 2, 1);
                    return size2 !== 1 ? (-y_end * (size2 - 1 - m) + y_end * m) / (size2 - 1) : 0;
                };

                let n = 0;
                let m = 0;
                output.push(makeAxis(5, [x(n), y(m)]));

                for (n = 0; n < size1; n++) {
                    output.push(makeAxis(6, [x(n), y(m)]));
                }
                n = size1 - 1;

                output.push(makeAxis(7, [x(n), y(m)]));

                for (m = 0; m < size2; m++) {
                    output.push(makeAxis(0, [x(n), y(m)]));
                }
                m = size2 - 1;

                output.push(makeAxis(1, [x(n), y(m)]));

                for (n = size1 - 1; n >= 0; n--) {
                    output.push(makeAxis(2, [x(n), y(m)]))
                }
                n = 0;

                output.push(makeAxis(3, [x(n), y(m)]));

                for (m = size2 - 1; m >= 0; m--) {
                    output.push(makeAxis(4, [x(n), y(m)]));
                }

                return output;
            },
            onMouseDown: function(event) {
                document.addEventListener('mousemove', this.onMouseMove);
                document.addEventListener('mouseup', this.onMouseUp);

                let workspace = document.getElementById('tensor-editor-workspace').getBoundingClientRect();

                this.dragSelector.dragging = true;
                this.dragSelector.startX = event.clientX - workspace.left;
                this.dragSelector.startY = event.clientY - workspace.top;
                this.dragSelector.endX = event.clientX - workspace.left;
                this.dragSelector.endY = event.clientY - workspace.top;
            },
            onMouseMove: function(event) {
                let workspace = document.getElementById('tensor-editor-workspace').getBoundingClientRect();

                this.dragSelector.endX = event.clientX - workspace.left;
                this.dragSelector.endY = event.clientY - workspace.top;
            },
            onMouseUp: function() {
                document.removeEventListener('mousemove', this.onMouseMove);
                document.removeEventListener('mouseup', this.onMouseUp);

                this.dragSelector.dragging = false;

                let x1 = this.dragSelector.startX;
                let x2 = this.dragSelector.endX;
                let y1 = this.dragSelector.startY;
                let y2 = this.dragSelector.endY;

                for (let i = 0; i < this.nodeShadow.axes.length; i++) {
                    let axis = this.nodeShadow.axes[i];
                    let duplicate = false;
                    for (let j = 0; j < this.node.axes.length; j++) {
                        let existingAxis = this.node.axes[j];
                        if (axis.angle === existingAxis.angle && axis.position[0] === existingAxis.position[0]
                            && axis.position[1] === existingAxis.position[1]) {
                            duplicate = true;
                            break
                        }
                    }
                    if (duplicate) {
                        continue;
                    }
                    let axisPoints = this.getAxisPoints(axis.position, axis.angle, 0);
                    let axisX = this.nodeShadow.position.x + axisPoints.x2;
                    let axisY = this.nodeShadow.position.y + axisPoints.y2;
                    if ((x1 <= axisX && axisX <= x2) || (x2 <= axisX && axisX <= x1)) {
                        if ((y1 <= axisY && axisY <= y2) || (y2 <= axisY && axisY <= y1)) {
                            this.node.axes.push(JSON.parse(JSON.stringify(axis)));
                        }
                    }
                }
                this.editNode();
            }
        },
        computed: {
            createMode: function() {
                return this.state.selectedNodes.length === 0;
            },
            createNodeDisabled: function() {
                return this.node.name == null || this.node.name === '' || this.nameTaken;
            },
            nameTaken: function() {
                for (let i = 0; i < this.state.nodes.length; i++) {
                    if (this.node.name === this.state.nodes[i].name) {
                        if (this.state.selectedNodes.length === 1) {
                            // If editing and not changing name, don't count as taken.
                            return this.state.nodes[i] !== this.state.selectedNodes[0];
                        }
                        return true;
                    }
                }
                return false;
            },
            nodeInitial: function() {
                return {
                    name: "",
                    size: [parseFloat(this.size1), parseFloat(this.size2)],
                    axes: [],
                    position: {x: 125, y: 125},
                    rotation: parseFloat(this.rotation),
                    hue: parseFloat(this.hue)
                };
            },
            nodeShadow: function() {
                return {
                    name: "",
                    size: [parseFloat(this.size1), parseFloat(this.size2)],
                    axes: this.axes(parseFloat(this.size1), parseFloat(this.size2)),
                    position: {x: 125, y: 125},
                    rotation: parseFloat(this.rotation),
                    hue: null
                };
            },
            renderLaTeX: function() {
                return this.state.renderLaTeX && window.MathJax;

            }
        },
        template: `
            <section class="tensor-editor">
                <h2 v-if="createMode">Create New Node</h2>
                <div v-else>
                    <a class="delete" href="" @click="deleteNode(event)">delete</a>
                    <h2>Edit Node {{state.selectedNodes[0].name}}</h2>
                </div>
                <p>Click on an axis to add or remove it. Drag-select to add multiple axes.</p>
                <div class="svg-container">
                    <svg class="workspace" id="tensor-editor-workspace" xmlns="http://www.w3.org/2000/svg" :width="width" :height="height"
                        @mousedown="onMouseDown">
                        <node :node="nodeShadow" :state="state" :disableDragging="true" :shadow="true"
                            @axismousedown="onShadowAxisMouseDown(node, ...arguments)" />
                        <node :node="node" :state="state" :disableDragging="true"
                            @axismousedown="onNodeAxisMouseDown(node, ...arguments)"/>
                        <drag-selector v-if="dragSelector.dragging" :startX="dragSelector.startX"
                            :startY="dragSelector.startY" :endX="dragSelector.endX" :endY="dragSelector.endY" />
                    </svg>
                </div>
                    <label>Width {{size1}}</label>
                    <input type="range" v-model="size1" min="1" max="7" step="1" class="slider" @mouseup="editNode">
                </div>
                </div>
                    <label>Height {{size2}}</label>
                    <input type="range" v-model="size2" min="1" max="7" step="1" class="slider" @mouseup="editNode">
                </div>
                <div>
                    <label>Color</label>
                    <input type="range" v-model="hue" min="0" max="359" step="1" class="slider" @mouseup="editNode">
                </div>
                <div>
                    <h4>Rotate</h4>
                    <button @click="rotate(-Math.PI / 4)">Counterclockwise</button>
                    <button @click="rotate(Math.PI / 4)">Clockwise</button>
                </div>
                <div class="button-holder">
                    <h4>Name</h4>
                    <form @submit="updateNode">
                        <input type="text" v-model="node.name" @keypress="stopPropagation" @keydown="stopPropagation" placeholder="node name" />
                        <input type="text" v-if="renderLaTeX" v-model="node.displayName" @keypress="stopPropagation" @keydown="stopPropagation" 
                            placeholder="LaTeX label" />
                        <input type="submit" :value="createMode ? 'Create' : 'Edit'" :disabled="createNodeDisabled" />
                    </form>
                </div>
            </section>
            
        `
    }
);

Vue.component(
    'toolbar-edge-section',
    {
        props: {
            state: Object
        },
        methods: {
            stopPropagation: function(event) {
                event.stopPropagation();
            },
            deleteEdge: function(event, edge) {
                event.preventDefault();
                this.state.edges = this.state.edges.filter(function(candidate) {
                    return candidate !== edge;
                });
            }
        },
        computed: {
            node: function() {
                return this.state.selectedNodes[0];
            }
        },
        template: `
            <section>
                <h3>Edges</h3>
                <div v-for="edge in state.edges">
                    <div v-if="edge[0][0] === node.name || edge[1][0] === node.name">
                        <div>
                            <a class="delete" href="" @click="deleteEdge(event, edge)">delete</a>
                            <h4>{{edge[0][0]}}[{{edge[0][1]}}] to {{edge[1][0]}}[{{edge[1][1]}}]</h4>
                        </div>
                        <label for="edge-name-input">Name</label>
                        <input id="edge-name-input" type="text" v-model="edge[2]" @keypress="stopPropagation" @keydown="stopPropagation"
                            placeholder="edge name" />
                    </div>
                </div>
            </section>
        `
    }
);

Vue.component(
    'toolbar-axis-section',
    {
        props: {
            state: Object
        },
        methods: {
            stopPropagation: function(event) {
                event.stopPropagation();
            }
        },
        computed: {
            node: function() {
                return this.state.selectedNodes[0];
            }
        },
        template: `
            <section>
                <h3>Axes</h3>
                <div v-for="(axis, index) in node.axes">
                    <div>
                        <h4>{{node.name}}[{{index}}]</h4>
                    </div>
                    <label for="axis-name-input">Name</label>
                    <input id="axis-name-input" type="text" v-model="node.axes[index].name" @keypress="stopPropagation" @keydown="stopPropagation"
                        placeholder="axis name" />
                </div>
            </section>
        `
    }
);

Vue.component(
    'toolbar-multinode-section',
    {
        mixins: [mixinDelete],
        props: {
            state: Object
        },
        data: function() {
            return {
                alignmentY: null,
                alignmentX: null,
                spacingY: null,
                spacingX: null
            }
        },
        created: function() {
            this.alignmentY = this.state.selectedNodes[0].position.y;
            this.alignmentX = this.state.selectedNodes[0].position.x;
            this.spacingY = this.state.selectedNodes[1].position.y - this.state.selectedNodes[0].position.y;
            this.spacingX = this.state.selectedNodes[1].position.x - this.state.selectedNodes[0].position.x;
        },
        methods: {
            deleteNodes: function(event) {
                event.preventDefault();
                this.deleteSelectedNodes();
            },
            alignVertically: function(event) {
                event.preventDefault();
                for (let i = 0; i < this.state.selectedNodes.length; i++) {
                    this.state.selectedNodes[i].position.y = parseFloat(this.alignmentY);
                }
            },
            alignHorizontally: function(event) {
                event.preventDefault();
                for (let i = 0; i < this.state.selectedNodes.length; i++) {
                    this.state.selectedNodes[i].position.x = parseFloat(this.alignmentX);
                }
            },
            spaceVertically: function(event) {
                event.preventDefault();
                let baseline = this.state.selectedNodes[0].position.y;
                for (let i = 1; i < this.state.selectedNodes.length; i++) {
                    this.state.selectedNodes[i].position.y = baseline + i * parseFloat(this.spacingY);
                }
            },
            spaceHorizontally: function(event) {
                event.preventDefault();
                let baseline = this.state.selectedNodes[0].position.x;
                for (let i = 1; i < this.state.selectedNodes.length; i++) {
                    this.state.selectedNodes[i].position.x = baseline + i * parseFloat(this.spacingX);
                }
            },
            disabledFor: function(length) {
                return length == null || length == "" || isNaN(parseFloat(length));
            }
        },
        template: `
            <div>
                <section>
                    <div>
                        <a class="delete" href="" @click="deleteNodes(event)">delete</a>
                        <h2>Multiple Nodes</h2>
                    </div>
                    <div v-for="node in state.selectedNodes">
                        <p><strong>{{node.name}}</strong> - <em>x</em>: {{node.position.x}}, <em>y</em>: {{node.position.y}}</p>
                    </div>
                    <em>Shift-click a node in the workspace to deselect it.</em>
                </section>
                <section>
                    <h3>Align Vertically</h3>
                    <form @submit="alignVertically">
                        <input type="number" v-model="alignmentY" />
                        <input type="submit" value="Align" :disabled="disabledFor(alignmentY)" />
                    </form>
                </section>
                <section>
                    <h3>Align Horizontally</h3>
                    <form @submit="alignHorizontally">
                        <input type="number" v-model="alignmentX" />
                        <input type="submit" value="Align" :disabled="disabledFor(alignmentX)" />
                    </form>
                </section>
                <section>
                    <h3>Space Vertically</h3>
                    <form @submit="spaceVertically">
                        <input type="number" v-model="spacingY" />
                        <input type="submit" value="Space" :disabled="disabledFor(spacingY)" />
                    </form>
                </section>
                <section>
                    <h3>Space Horizontally</h3>
                    <form @submit="spaceHorizontally">
                        <input type="number" v-model="spacingX" />
                        <input type="submit" value="Space" :disabled="disabledFor(spacingX)" />
                    </form>
                </section>
            </div>
        `
    }
);
