# Polyhedron Star

This demo shows how polyhedra can be constructed by folding certain star-shaped
polygons.
For the math background see
[this paper](https://arxiv.org/pdf/math/9801088) by William P. Thurston
(in particular section 7)
and
[these](https://johncarlosbaez.wordpress.com/2024/10/25/triangulations-of-the-sphere/)
blog
[posts](https://johncarlosbaez.wordpress.com/2024/10/30/triangulations-of-the-sphere-part-2/)
by John Carlos Baez.


## What It Does

If you have a polyhedron, you can flatten its surface like this:
- Choose one vertex as the "start vertex".
- Cut the surface along each edge adjacent to the start vertex.
- For each vertex not yet reached find a shortest line from the start vertex
  and cut along that line.

Now you can unfold the surface to a flat shape resembling a star.

This application performs the inverse operation:
folding a star (with certain properties) to a polyhedron.


## HOWTO

To get a first impression, have a look at the provided examples, which can be
selected near the top of the page.
- The first example (based on the star from the Thurston paper)
  comes with explanatory comments.
- Also various regular polyhedra are provided.

You can edit an example and click the "run" button to see what manifold it
generates.  (Caution: If you switch to another example, your edits will be lost.
So it might be best to edit files in your favorite editor and to copy/paste them
to the text area.)

Various inputs allow you to modify the graphic output.
Most of them should be self-explanatory, but some notes might be helpful:
- Some objects can be switched on and off with checkboxes.  But "breaks"
  and the "flower" anyway not visible when the polyhedron is fully folded.
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
  crosses the edge.  But it does depend on the side of the polygon surface
  on which it walks.  So we need to define one side of our star or polyhedron
  as the "ant walking side".)

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
Use the
[discussion area](https://github.com/hcschuetz/polyhedron-star/discussions)
of this project (or even provide a pull request).
<br>
[TODO: Check if a discussion contribution can be written without a github account.
Otherwise I need to find another way to receive shapes.]


## Edges Across Star Gaps

An edge between two inner vertices of the star is a line segment
that is "straight" according to some special metric.  That metric
says that you can jump over a gap to the corresponding point on the other side
"at no cost".  This also means that a "straight" line entering a gap with some
angle to one side of the gap has to leave it with the same angle to the
opposite side of the gap.

I do not require an edge specification to locate the intersection points
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


## The Constraint Solver

The polyhedron geometry depends on the lengths of the edges you specified.

For specific situations there are closed-form solutions.
Consider a tetrahedron with 6 given edge lengths.  You can proceed like this.
- Select one vertex $a$ and place it somewhere.
- Select another vertex $b$ and place it somewhere on the sphere with center
  $a$ and radius $|ab|$.  We call this $Sph(a, b)$.
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

But I am not aware of a closed-form approach for the general case.
So I implemented an approximation method for our constraint problem.
It first tries to find a set of vertex positions such that each
given edge length fits with the distance between the positions of
the two ends of the edge.
Then it simply "measures" the angles trigonometrically using the `atan2` function.

The vertex positions are defined iteratively.
- We use both the "inner" and "outer" vertices of the star.
  (In the result the outer vertices should approximately coincide.)
  Their initial positions are computed based on the provided bending angles.
- Now each iteration step works as follows:
  - For each edge $pq$ with given length $l$ compute a "force"
    ```math
    \left({l-|q-p|}\right){q-p\over|q-p|}
    ```
    acting on $q$
    and the opposite force on $p$.
  - For certain pairs $(p, q)$ of outer vertices compute a force
    ```math
    p-q
    ```
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
But it turned out to converge on my examples quite fast (< 30ms on a
not-so-new and non-high-end laptop).

More remarks:
- The edge lengths do not uniquely determine the polyhedron geometry.
  In particular, the mirror image of a polyhedron has the same edge
  lengths.  Or think of a regular icosahedron with one vertex pushed inward to
  make it concave.  This is the reason why some initial edge angles are needed.
- The position and attitude of the polyhedron in 3D space is not determined
  by our constraints.  So the problem is underspecified.
  But this is not a problem since we are anyway only interested
  in the internal angles.
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
