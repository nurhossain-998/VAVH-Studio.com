CSS - these lines are added for testing purposes, to center the cards and add spacing between them. Adjust as needed for your design.

.category-strip {
  display: flex;
  justify-content: center; /* Centers all cards */
  align-items: center;
  gap: 24px; /* Space between cards */
  flex-wrap: wrap; /* Allows wrapping on smaller screens */
  margin-top: 2rem;
}

.category-strip {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 28px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}
 main.js line 4183 and 4182
<!-- ===================================================================
     GLOBAL SEARCH BANNER — cross-page result notification
     =================================================================== -->
<div id="global-search-banner">
  <i class="fas fa-search" style="color:var(--accent-green);font-size:16px;flex-shrink:0;"></i>
  <p id="global-search-banner-text">Found results on another page.</p>
  <button id="global-search-banner-goto" onclick="globalSearchGoto()">Go to Results</button>
  <button class="banner-close" onclick="dismissSearchBanner()" title="Dismiss">&times;</button>
</div>