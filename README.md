# Polyhedron Star

[This demo](https://hcschuetz.github.io/polyhedron-star/dist/)
shows how polyhedra can be constructed by folding certain star-shaped
polygons.
(For the math background see
[this paper](https://arxiv.org/pdf/math/9801088) by William P. Thurston
(in particular section 7)
and
[these](https://johncarlosbaez.wordpress.com/2024/10/25/triangulations-of-the-sphere/)
blog
[posts](https://johncarlosbaez.wordpress.com/2024/10/30/triangulations-of-the-sphere-part-2/)
by John Carlos Baez.)


## What It Does

If you have a polyhedron, you can flatten its surface like this:
- Choose one vertex as the "start vertex".
- Cut the surface along each edge adjacent to the start vertex.
- For each vertex not yet reached find a shortest line from the start vertex
  and cut along that line.

Now you can unfold the surface to a flat shape resembling a star.

This application performs the inverse operation:
folding a star (with certain properties) to a polyhedron.


## How To Use It

To get a first impression, have a look at the provided examples, which can be
selected below the text area.
- The first example (based on the star from the Thurston paper)
  comes with explanatory comments.
- Also various (more or less) regular polyhedra are provided.

You can edit an example and click the "run" button to see what manifold it
generates.  (Caution: If you switch to another example, your edits will be lost.
So it might be best to edit files in your favorite editor and to copy/paste them
to the text area using the "paste" button.)

Various inputs allow you to modify the graphic output.
Most of them should be self-explanatory, but some notes might be helpful:
- Some objects can be switched on and off with checkboxes.  But "breaks"
  and the "flower" are anyway not visible when the polyhedron is fully folded.
  They are intended for use with the flat star.
- Instead of dihedral angles between faces I use "bending angles",
  which are easier to work with.
  A "bending angle" is
  - 180° minus the corresponding dihedral angle,
  - the angle between the face normals, and
  - the rotation performed by an ant walking on the polyhedron
    when crossing the edge orthogonally.

  Bending angles are signed, indicating whether the ant rotates upward or downward.
  (Notice that the sign does not depend on the direction in which the ant
  crosses the edge.  But it does depend on the side of the surface
  on which it walks.  So we have to consistently treat one side of our star or
  polyhedron as the "ant walking side".)

  The bending slider allows you to scale the bending angles between 0 and 100%
  to give a smooth transformation from the star to the polyhedron.
- The bending angles at the edges are hard to figure out.
  But the application will try to approximate correct angles from some
  (very rough!) approximation you provide.
  Check the "autobend" checkbox to use these angles instead of the explicitly
  provided angles.


## Your Stars And Polyhedra

If you have an interesting shape, let me know so I can include it in the
list of examples.
You can
- use the [discussion area](https://github.com/hcschuetz/polyhedron-star/discussions)
  of this project (or even provide a pull request)
- or send it to my Mastodon account @hcschuetz@mastodon.social.


## Notes On The Inner Workings Of The Demo

### Edges Across Star Gaps

An edge between two inner vertices of the star is a line segment
that is "straight" according to some special metric.  That metric
says that you can jump over a gap to the corresponding point on the other side
"at no cost".  This also means that a "straight" line entering a gap with some
angle to one side of the gap has to leave it with the same angle to the
opposite side of the gap.

An edge specification does not locate the intersection points
between an edge and the gap sides.  So how do we find the intersection points?

It is probably easiest to understand with an example:
Consider the edge from `b` to `e` crossing gaps `c` and `d` in the "Thurston"
example.  (Check the checkboxes "edges", "breaks", and "cuts".)
- Since we have to deal with two gaps, make two copies of the star
  and still use the original one, so we work with three stars
  $S_0$, $S_1$, and $S_2$.
- Place $S_1$ on $S_0$ in such a way that
  the left  side of gap `c` in $S_1$ aligns with
  the right side of gap `c` in $S_0$.
- Similarly place $S_2$ on $S_1$ in such a way that
  the left  side of gap `d` in $S_2$ aligns with
  the right side of gap `d` in $S_1$.
- Draw a straight line from vertex `b` on $S_0$ to vertex `e` on $S_2$
  ("straight" now in the sense of the usual Euclidean metric).
  Hope that your line actually crosses the two aligned gaps (but no other gaps).
- Now you have three edge segments across three star jags on three stars.
  Copy them to the corresponding places on a single star.

It should be easy to see how this generalizes to an arbitrary number of gap
crossings.  It even works for zero gap crossings:  We just draw a line on the
original star $S_0$.

The implemented algorithm essentially simulates this pencil & paper & ruler
approach by applying rotations around the inner vertices of the crossed gaps.


### Vertices And Vertex Positions

We have three kinds of vertices:
- Vertices of the initial polygon.  These are also tips of the star.
  They should coincide when the star is folded to a polygon.
  In the demo they are painted red if you check the "vertices" checkbox.
- Apices of the gaps.  These are the inner nodes of the star.
  Blue in the demo.
- Crossings between edges and the star boundary.
  They come in pairs since an edge entering a gap will leave it
  on the other side.
  When folding the star, the vertices of a pair should coincide.
  Green in the demo.

For each vertex we store three kinds of positions:
- The "2D position" tells where the vertex is in the flat star.
- The "3D position" tells where it is in the (partially) folded polyhedron.
- Now notice that all the vertices are placed on the star boundary.
  So a "1D position" can locate a vertex with a single real number.

The 1D positions could be distances along the boundary from some start point.
But we actually use a different value:
- The (blue) inner vertices have even 1D positions 0, 2, 4, ...
- The (red) outer vertices have odd 1D positions 1, 3, 5, ...
- The (green) crossing vertices have non-integer 1D positions
  that are interpolated between their inner and outer neighbors.

While this is not geometrically accurate, it is correct from a topological
viewpoint.
We use it to determine the topology of the star subdivision by the edge segments.
In the Thurston example of the demo this helps us to figure out that
edge `i a` crosses gap `k` closer to the inner vertex `k` than edge `j a` does.

And a more technical note:
While 1D and 2D positions are stored as vertex properties, 3D positions are
stored separately.
This allows us to deal with "hypothetical" vertex placements.
We use this in the constraint solver (see below)
and for positioning vertices in a partially bent manifold.


### The Constraint Solver

The 3D polyhedron geometry depends on the lengths of the edges you specified.
It is constructed just from the edge lengths
- between inner vertices and
- between inner and outer vertices.

The crossing vertices can be computed afterwards
by interpolation between the neighboring inner and outer vertex,
using the 1D positions.

#### Closed-Form Solver

For specific situations there are closed-form solutions.
Consider a tetrahedron with 6 given edge lengths.  You can proceed like this.
- Select one vertex $a$ and place it somewhere.
- Select another vertex $b$ and place it somewhere on the sphere with center
  $a$ and radius $|ab|$.  We call this sphere $Sph(a, b)$.
- Select yet another vertex $c$ and place it somewhere on the intersection
  of the spheres $Sph(a,c)$ and $Sph(b,c)$.
- Finally place the remaining vertex $d$ on the intersection of 
  $Sph(a,d)$, $Sph(b,d)$, and $Sph(c,cd)$.

For this you just have to solve some quadratic equations.
Solutions do not exist for the quadratic equations if the spheres do not intersect.

This method is also applicable in more complex polyhedra at vertices of degree 3.
And if you have a vertex of degree 4 where the bend angle for one adjacent edge
is already known, then the solution is similar.  And so on.

And for a regular polyhedron you can simply look up the dihedral angle in
Wikipedia and subtract it from 180°.
(That's what I did for some of the examples.)

#### Iterative Solver

But I am not aware of a closed-form approach for the general case.
So I implemented an approximation method for our constraint problem.
It first tries to find a set of (3D) vertex positions such that each
given edge length fits with the distance between the positions of
the two ends of the edge.
Then it simply "measures" the angles trigonometrically using the `atan2` function.

The vertex positions are defined iteratively.
- We use both the "inner" and "outer" vertices of the star.
  (In the result the outer vertices should approximately coincide.)
  Their initial positions are computed based on the provided bending angles.
- Now each iteration step works as follows:
  - For each edge $pq$ with given length $l$ compute a "force"

      $$\left({l-\left|q-p\right|}\right){q-p\over\left|q-p\right|} = \left({{l\over\left|q-p\right|}-1}\right) \left(q-p\right)$$

    acting on $q$
    and the opposite force acting on $p$.
  - For certain pairs $(p, q)$ of outer vertices compute a force

      $$p-q$$

    acting on $q$ and the opposite force on $p$.
    <br>
    Notes:
    - These forces are like the forces for an edge $pq$ of length $0$.
    - I do not use all pairs or outer vertices because this turned out to slow
      down convergence.  I use only pairs of neighboring star tips.
  - Finally we apply the forces by moving each vertex by the average
    (not the sum!) of the respective acting forces.
- The iteration terminates after some maximum number of steps or
  when the positioning is considered to be "good enough".
  The latter means that the sum of squared forces is below some limit,
  in the current implementation $10^{-16}$.

The algorithm is quite ad-hoc and could be investigated theoretically.
Or it might be replaced by something more theoretically sound.
But it turned out to converge quite fast on my examples (< 30ms on a
not-so-new and non-high-end laptop).

More remarks:
- The edge lengths do not uniquely determine the polyhedron geometry.
  In particular, the mirror image of a polyhedron has the same edge
  lengths.  Or think of a regular icosahedron with one vertex pushed inward to
  make it concave.  This is the reason why some initial edge angles are needed.
- The position and attitude of the polyhedron in 3D space is not determined
  by our constraints.
  But this is not a problem since we are only interested in the "internal"
  geometry.
  Actually leaving the degrees of freedom for position and attitude
  unconstrained speeds up convergence.


## Limitations

For the time being the code does not explicitly check for correct/consistent
input.  So you have to take care of this by yourself.
For example:
- The JSON5 input must be syntactically correct and also have the appropriate
  structure
  (which is not yet documented, but should be clear from the examples).
- The initial polygon (connecting the star tips) should be closed.
- The edges you provide should not intersect.
- Let $v$ be the number of polyhedron vertices
  (one for each star gap plus one more vertex where all the jag tips meet).
  Then there should be $3(v-2)$ edges defining $2(v-2)$ triangular polygon faces.
- The constraint system given by the edge lengths should be solvable.

Text output is currently written to the browser console, not to the web page.
